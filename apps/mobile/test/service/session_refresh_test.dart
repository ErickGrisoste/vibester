import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/auth_storage_service.dart';

String jwt(Duration validade) {
  String parte(Map<String, dynamic> m) =>
      base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  final exp = DateTime.now().add(validade).millisecondsSinceEpoch ~/ 1000;
  return '${parte({'alg': 'HS256'})}.${parte({'exp': exp})}.assinatura';
}

/// Servidor falso: responde cada requisição com o que [responder] devolver e
/// guarda o que chegou. Passa pelo tratamento real de status do Dio, então um
/// 401 aqui vira `DioException` como em produção.
class FakeAdapter implements HttpClientAdapter {
  FakeAdapter(this.responder);

  final (int, Object?) Function(RequestOptions options) responder;
  final requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    // Dá chance de requisições concorrentes se sobreporem, como na rede.
    await Future<void>.delayed(const Duration(milliseconds: 5));
    final (status, body) = responder(options);
    return ResponseBody.fromString(
      body == null ? '' : jsonEncode(body),
      status,
      headers: {
        Headers.contentTypeHeader: [Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late HttpClientAdapter apiOriginal;
  late HttpClientAdapter sessionOriginal;
  late int sessaoExpirada;

  final tokenVencido = jwt(const Duration(minutes: -1));
  final tokenNovo = jwt(const Duration(minutes: 15));

  setUpAll(() {
    apiOriginal = ApiClient.dio.httpClientAdapter;
    sessionOriginal = ApiClient.sessionDio.httpClientAdapter;
  });

  setUp(() {
    FlutterSecureStorage.setMockInitialValues({});
    sessaoExpirada = 0;
    ApiClient.onSessionExpired = () => sessaoExpirada++;
  });

  tearDown(() {
    ApiClient.dio.httpClientAdapter = apiOriginal;
    ApiClient.sessionDio.httpClientAdapter = sessionOriginal;
    ApiClient.onSessionExpired = null;
    ApiClient.clearSession();
  });

  /// API que aceita só o [tokenNovo].
  FakeAdapter api() => FakeAdapter((o) {
    final ok = o.headers['Authorization'] == 'Bearer $tokenNovo';
    return ok ? (200, {'ok': true}) : (401, {'error': 'Token inválido'});
  });

  test('renova antes de sair quando o access token já venceu', () async {
    final servidor = api();
    final sessao = FakeAdapter(
      (_) => (200, {'accessToken': tokenNovo, 'refreshToken': 'r2', 'expiresIn': 900}),
    );
    ApiClient.dio.httpClientAdapter = servidor;
    ApiClient.sessionDio.httpClientAdapter = sessao;
    ApiClient.setSession(accessToken: tokenVencido, refreshToken: 'r1');

    final res = await ApiClient.dio.get('https://api.test/feed');

    expect(res.statusCode, 200);
    expect(sessao.requests.single.data, {'refreshToken': 'r1'});
    expect(servidor.requests.single.headers['Authorization'], 'Bearer $tokenNovo');
    expect(ApiClient.token, tokenNovo);
    expect(await AuthStorageService.loadRefreshToken(), 'r2');
    expect(sessaoExpirada, 0);
  });

  test('401 com token ainda "válido" renova e repete a requisição', () async {
    // Token que o app acha válido, mas o servidor recusa (ex.: relógio).
    final tokenRecusado = jwt(const Duration(minutes: 10));
    final servidor = api();
    ApiClient.dio.httpClientAdapter = servidor;
    ApiClient.sessionDio.httpClientAdapter = FakeAdapter(
      (_) => (200, {'accessToken': tokenNovo, 'refreshToken': 'r2', 'expiresIn': 900}),
    );
    ApiClient.setSession(accessToken: tokenRecusado, refreshToken: 'r1');

    final res = await ApiClient.dio.get('https://api.test/feed');

    expect(res.statusCode, 200);
    expect(servidor.requests, hasLength(2));
    expect(sessaoExpirada, 0);
  });

  test('requisições simultâneas compartilham um único refresh', () async {
    final sessao = FakeAdapter(
      (_) => (200, {'accessToken': tokenNovo, 'refreshToken': 'r2', 'expiresIn': 900}),
    );
    ApiClient.dio.httpClientAdapter = api();
    ApiClient.sessionDio.httpClientAdapter = sessao;
    ApiClient.setSession(accessToken: tokenVencido, refreshToken: 'r1');

    final respostas = await Future.wait([
      for (var i = 0; i < 5; i++) ApiClient.dio.get('https://api.test/feed/$i'),
    ]);

    expect(respostas.map((r) => r.statusCode), everyElement(200));
    expect(sessao.requests, hasLength(1));
  });

  test('refresh recusado encerra a sessão uma vez só', () async {
    ApiClient.dio.httpClientAdapter = api();
    ApiClient.sessionDio.httpClientAdapter = FakeAdapter(
      (_) => (401, {'error': 'Sessão inválida ou expirada'}),
    );
    ApiClient.setSession(accessToken: tokenVencido, refreshToken: 'r1');

    await Future.wait([
      for (var i = 0; i < 3; i++)
        ApiClient.dio.get('https://api.test/feed/$i').catchError(
          (_) => Response(requestOptions: RequestOptions()),
        ),
    ]);

    expect(sessaoExpirada, 1);
  });

  test('sem rede para renovar não derruba a sessão', () async {
    ApiClient.dio.httpClientAdapter = api();
    ApiClient.sessionDio.httpClientAdapter = FakeAdapter(
      (_) => (503, {'error': 'indisponível'}),
    );
    ApiClient.setSession(accessToken: tokenVencido, refreshToken: 'r1');

    await expectLater(
      ApiClient.dio.get('https://api.test/feed'),
      throwsA(isA<DioException>()),
    );

    expect(sessaoExpirada, 0);
    expect(ApiClient.token, tokenVencido);
  });

  test('sem refresh token, 401 encerra a sessão direto', () async {
    ApiClient.dio.httpClientAdapter = api();
    final sessao = FakeAdapter((_) => (200, {}));
    ApiClient.sessionDio.httpClientAdapter = sessao;
    ApiClient.setSession(accessToken: tokenVencido);

    await expectLater(
      ApiClient.dio.get('https://api.test/feed'),
      throwsA(isA<DioException>()),
    );

    expect(sessao.requests, isEmpty);
    expect(sessaoExpirada, 1);
  });

  test('401 em /auth/ é credencial errada, não gatilho de refresh', () async {
    ApiClient.dio.httpClientAdapter = FakeAdapter(
      (_) => (401, {'error': 'Senha incorreta'}),
    );
    final sessao = FakeAdapter((_) => (200, {}));
    ApiClient.sessionDio.httpClientAdapter = sessao;
    ApiClient.setSession(accessToken: tokenNovo, refreshToken: 'r1');

    await expectLater(
      ApiClient.dio.delete('https://api.test/auth/account'),
      throwsA(isA<DioException>()),
    );

    expect(sessao.requests, isEmpty);
    expect(sessaoExpirada, 0);
  });

  test('logout avisa o servidor com o refresh token e limpa a memória', () async {
    final sessao = FakeAdapter((_) => (204, null));
    ApiClient.sessionDio.httpClientAdapter = sessao;
    ApiClient.setSession(accessToken: tokenNovo, refreshToken: 'r1');

    await ApiClient.logout();

    expect(sessao.requests.single.uri.path, '/auth/logout');
    expect(sessao.requests.single.data, {'refreshToken': 'r1'});
    expect(ApiClient.token, isNull);
  });
}
