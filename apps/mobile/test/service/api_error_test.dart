import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_error.dart';

DioException erro({
  int? status,
  dynamic data,
  DioExceptionType type = DioExceptionType.badResponse,
}) {
  final options = RequestOptions(path: '/x');
  return DioException(
    requestOptions: options,
    type: type,
    response: status == null
        ? null
        : Response(requestOptions: options, statusCode: status, data: data),
  );
}

String jwt(Map<String, dynamic> payload) {
  String parte(Map<String, dynamic> m) =>
      base64Url.encode(utf8.encode(jsonEncode(m))).replaceAll('=', '');
  return '${parte({'alg': 'HS256'})}.${parte(payload)}.assinatura';
}

void main() {
  group('apiErrorMessage', () {
    test('lê a chave message', () {
      expect(
        apiErrorMessage(
          erro(status: 409, data: {'message': 'Post already liked'}),
          'x',
        ),
        'Post already liked',
      );
    });

    test('lê a chave error (auth-service, payment-service)', () {
      expect(
        apiErrorMessage(
          erro(status: 401, data: {'error': 'Usuário ou senha inválidos'}),
          'Erro ao fazer login',
        ),
        'Usuário ou senha inválidos',
      );
    });

    test('corpo em texto puro do gateway não quebra', () {
      expect(
        apiErrorMessage(
          erro(status: 404, data: '404 page not found'),
          'Erro X',
        ),
        'Erro X',
      );
    });

    test('5xx vira mensagem genérica, mesmo com texto do servidor', () {
      final msg = apiErrorMessage(
        erro(status: 500, data: {'message': 'Error fetching profile'}),
        'Erro ao buscar perfil',
      );
      expect(msg, isNot(contains('Error fetching profile')));
      expect(msg, contains('indisponível'));

      expect(
        apiErrorMessage(erro(status: 503, data: 'no available server'), 'x'),
        contains('indisponível'),
      );
    });

    test('sem resposta (timeout) fala de conexão', () {
      expect(
        apiErrorMessage(erro(type: DioExceptionType.connectionTimeout), 'x'),
        contains('conexão'),
      );
    });
  });

  group('ApiClient.isTokenExpired', () {
    int epoch(DateTime d) => d.millisecondsSinceEpoch ~/ 1000;

    test('token vencido', () {
      final token = jwt({
        'exp': epoch(DateTime.now().subtract(const Duration(minutes: 1))),
      });
      expect(ApiClient.isTokenExpired(token), isTrue);
    });

    test('token válido', () {
      final token = jwt({
        'exp': epoch(DateTime.now().add(const Duration(minutes: 30))),
      });
      expect(ApiClient.isTokenExpired(token), isFalse);
    });

    test('sem exp não expira; ilegível conta como vencido', () {
      expect(ApiClient.isTokenExpired(jwt({'accountId': 'a'})), isFalse);
      expect(ApiClient.isTokenExpired('lixo'), isTrue);
    });
  });
}
