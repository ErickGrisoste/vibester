import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/user/user_service.dart';

/// Contrato da listagem de seguidores/seguindo do lado do app: a rota certa,
/// os parâmetros de paginação, o parse da página e — principalmente — o que
/// acontece quando a resposta não é a esperada.
void main() {
  late List<RequestOptions> requisicoes;
  late Interceptor capturador;
  late dynamic corpo;
  late int status;

  setUp(() {
    requisicoes = [];
    status = 200;
    corpo = {'data': [], 'nextCursor': null};
    capturador = InterceptorsWrapper(
      onRequest: (options, handler) {
        requisicoes.add(options);
        final resposta = Response(
          requestOptions: options,
          statusCode: status,
          data: corpo,
        );
        // Igual ao Dio real: status de erro não "resolve", vira DioException.
        if (status >= 400) {
          handler.reject(
            DioException(
              requestOptions: options,
              response: resposta,
              type: DioExceptionType.badResponse,
            ),
          );
          return;
        }
        handler.resolve(resposta);
      },
    );
    ApiClient.dio.interceptors.insert(0, capturador);
  });

  tearDown(() => ApiClient.dio.interceptors.remove(capturador));

  test('busca seguidores na rota do user-service, com limite e cursor', () async {
    corpo = {
      'data': [
        {
          'accountId': 'conta-2',
          'name': 'Bia',
          'username': 'bia',
          'avatarUrl': 'https://cdn/x',
          'followers': 7,
          'followedAt': '2026-03-01T00:00:00.000Z',
        },
      ],
      'nextCursor': '2026-03-01T00:00:00.000Z',
    };

    final pagina = await UserService().listFollowers(
      'conta-1',
      cursor: '2026-04-01T00:00:00.000Z',
    );

    final pedido = requisicoes.single;
    expect(pedido.method, 'GET');
    expect(pedido.path, contains('/user/users/conta-1/followers'));
    expect(pedido.queryParameters['limit'], 30);
    expect(pedido.queryParameters['cursor'], '2026-04-01T00:00:00.000Z');

    expect(pagina.perfis.single.nome, 'Bia');
    expect(pagina.perfis.single.seguidores, 7);
    expect(pagina.perfis.single.seguidoEm, DateTime.utc(2026, 3, 1));
    expect(pagina.nextCursor, '2026-03-01T00:00:00.000Z');
  });

  test('quem o perfil segue usa a rota /following', () async {
    await UserService().listFollowing('conta-1');

    expect(requisicoes.single.path, contains('/user/users/conta-1/following'));
    expect(requisicoes.single.queryParameters.containsKey('cursor'), isFalse);
  });

  test('resposta fora do contrato vira mensagem tratada, não TypeError', () async {
    // A versão antiga do user-service devolvia uma lista de ids em vez da
    // página. O cast direto lançaria um TypeError de dentro do try e o texto
    // do Dart apareceria na tela.
    corpo = [
      {'followerId': 'conta-2', 'createdAt': '2026-03-01T00:00:00.000Z'},
    ];

    await expectLater(
      UserService().listFollowers('conta-1'),
      throwsA(
        isA<Exception>().having(
          (e) => e.toString(),
          'mensagem',
          allOf(
            contains('Erro ao carregar seguidores'),
            isNot(contains('TypeError')),
            isNot(contains('subtype')),
          ),
        ),
      ),
    );
  });

  test('erro do servidor vira mensagem genérica tratada', () async {
    status = 500;
    corpo = {'message': 'Response doesn\'t match the schema'};

    await expectLater(
      UserService().listFollowers('conta-1'),
      throwsA(
        isA<Exception>().having(
          (e) => e.toString(),
          'mensagem',
          // 5xx não expõe o detalhe interno do backend ao usuário.
          isNot(contains('schema')),
        ),
      ),
    );
  });
}
