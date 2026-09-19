import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

class ApiClient {
  //Guardado aqui pra ser lido pelo interceptor abaixo e anexado automaticamente
  //em toda chamada. É setado pela tela depois do login/registro dar certo.
  static String? _token;
  static String? get token => _token;
  static set token(String? value) {
    _token = value;
    _sessionExpiredNotified = false;
  }

  /// Chamado uma vez quando uma rota autenticada responde 401 — o JWT
  /// expirou (o auth-service emite com validade de 1h e não há refresh) ou
  /// foi invalidado. Registrado em `main.dart`, que encerra a sessão e leva
  /// ao login; sem isso o feed ficava quebrado até o usuário sair na mão.
  static VoidCallback? onSessionExpired;
  static bool _sessionExpiredNotified = false;

  static final Dio dio =
      Dio(
          BaseOptions(
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 10),
          ),
        )
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              if (_token != null && _token!.isNotEmpty) {
                options.headers['Authorization'] = 'Bearer $_token';
              }
              handler.next(options);
            },
            onError: (error, handler) {
              if (_isExpiredSession(error)) {
                _sessionExpiredNotified = true;
                onSessionExpired?.call();
              }
              handler.next(error);
            },
          ),
        )
        // Só em debug. Este interceptor imprime `requestBody` e
        // `requestHeader`, ou seja, o corpo de POST /auth/login e
        // /auth/register — com a senha em texto plano — e o header
        // Authorization com o JWT. Incondicional, isso ia parar no log do
        // aparelho em build de release, legível via adb logcat/Console.
        ..interceptors.addAll([
          if (kDebugMode)
            LogInterceptor(
              requestHeader: true,
              requestBody: true,
              responseHeader: false,
              responseBody: true,
              error: true,
            ),
        ]);

  // 401 de /auth/* é credencial errada no login, não sessão vencida. E só
  // conta se a requisição levou token: sem token não havia sessão a perder.
  static bool _isExpiredSession(DioException error) {
    if (_sessionExpiredNotified) return false;
    if (error.response?.statusCode != 401) return false;
    if (error.requestOptions.headers['Authorization'] == null) return false;
    return !error.requestOptions.uri.path.startsWith('/auth/');
  }

  /// Lê o `exp` do JWT sem validar assinatura — só para não restaurar no boot
  /// uma sessão que o backend já vai recusar. Token ilegível conta como
  /// vencido.
  static bool isTokenExpired(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      );
      final exp = payload is Map ? payload['exp'] : null;
      if (exp is! num) return false;
      final expiresAt = DateTime.fromMillisecondsSinceEpoch(exp.toInt() * 1000);
      return DateTime.now().isAfter(expiresAt);
    } catch (_) {
      return true;
    }
  }
}
