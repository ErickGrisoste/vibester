import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/auth_storage_service.dart';

/// Desfecho de uma tentativa de renovar a sessão.
enum RefreshResult {
  /// Par novo recebido e gravado.
  refreshed,

  /// O servidor recusou o refresh token (vencido, revogado, conta suspensa):
  /// só um novo login resolve.
  invalid,

  /// Não deu para perguntar (sem rede, timeout, 5xx). A sessão continua
  /// válida e a próxima requisição tenta de novo.
  unavailable,
}

class ApiClient {
  // Access token (JWT curto, ~15 min) anexado pelo interceptor em toda
  // chamada, e refresh token (opaco, ~30 dias renováveis) usado só para pedir
  // um access token novo. Setados pela tela depois do login/registro dar certo
  // e, a partir daí, renovados aqui mesmo.
  static String? _token;
  static String? _refreshToken;
  static String? get token => _token;

  static void setSession({required String accessToken, String? refreshToken}) {
    _token = accessToken;
    _refreshToken = refreshToken;
    _sessionExpiredNotified = false;
  }

  static void clearSession() {
    _token = null;
    _refreshToken = null;
  }

  /// Chamado uma vez quando a sessão acaba de verdade: rota autenticada
  /// respondeu 401 e o refresh token também foi recusado (ou não existe).
  /// Registrado em `main.dart`, que
  /// encerra a sessão e leva ao login.
  static VoidCallback? onSessionExpired;
  static bool _sessionExpiredNotified = false;

  /// Renova um pouco antes de vencer, para a requisição não sair com um token
  /// que expira no meio do caminho.
  static const _refreshMargin = Duration(seconds: 30);

  /// Marca a requisição repetida depois do refresh: um segundo 401 nela é
  /// sessão encerrada, não motivo para renovar de novo.
  static const _retriedKey = 'vibester.retried';

  /// Refresh em andamento. Várias requisições que vencem juntas (o feed
  /// dispara várias) esperam a mesma renovação: duas trocas em paralelo do
  /// mesmo refresh token fariam o servidor ver reuso e derrubar a sessão.
  static Future<RefreshResult>? _refreshing;

  static const _timeouts = (
    connect: Duration(seconds: 10),
    receive: Duration(seconds: 10),
  );

  /// Cliente só para /auth/refresh e /auth/logout: sem interceptors, para o
  /// refresh não disparar refresh nem cair no 401 de sessão expirada, e sem o
  /// LogInterceptor, que imprimiria o refresh token no log.
  @visibleForTesting
  static final Dio sessionDio = Dio(
    BaseOptions(
      connectTimeout: _timeouts.connect,
      receiveTimeout: _timeouts.receive,
    ),
  );

  static final Dio dio =
      Dio(
          BaseOptions(
            connectTimeout: _timeouts.connect,
            receiveTimeout: _timeouts.receive,
          ),
        )
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) async {
              final token = _token;
              if (token != null &&
                  _refreshToken != null &&
                  isTokenExpired(token, margin: _refreshMargin)) {
                // Falhar aqui não impede a requisição: ela sai com o token
                // atual e, se voltar 401, o onError decide.
                await refreshSession();
              }
              if (_token != null && _token!.isNotEmpty) {
                options.headers['Authorization'] = 'Bearer $_token';
              }
              handler.next(options);
            },
            onError: (error, handler) async {
              if (!_isAuthFailure(error)) return handler.next(error);

              final options = error.requestOptions;
              if (_refreshToken != null && options.extra[_retriedKey] != true) {
                // Outra requisição pode já ter renovado enquanto esta estava
                // no ar: aí basta repetir com o token novo.
                final sentWith = options.headers['Authorization'];
                final result = sentWith != 'Bearer $_token'
                    ? RefreshResult.refreshed
                    : await refreshSession();

                if (result == RefreshResult.refreshed) {
                  options.extra[_retriedKey] = true;
                  try {
                    return handler.resolve(await dio.fetch(options));
                  } on DioException catch (retryError) {
                    return handler.next(retryError);
                  }
                }
                // Sem rede para renovar não é sessão perdida.
                if (result == RefreshResult.unavailable) {
                  return handler.next(error);
                }
              }

              _notifySessionExpired();
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

  /// Troca o refresh token por um par novo. Chamadas simultâneas compartilham
  /// a mesma troca.
  static Future<RefreshResult> refreshSession() {
    return _refreshing ??= _doRefresh().whenComplete(() => _refreshing = null);
  }

  static Future<RefreshResult> _doRefresh() async {
    final refreshToken = _refreshToken;
    if (refreshToken == null) return RefreshResult.invalid;

    try {
      final response = await sessionDio.post(
        ApiEndpoints.refreshSession(),
        data: {'refreshToken': refreshToken},
      );
      final data = response.data;
      final accessToken = data is Map ? data['accessToken'] : null;
      final nextRefreshToken = data is Map ? data['refreshToken'] : null;
      if (accessToken is! String || nextRefreshToken is! String) {
        return RefreshResult.unavailable;
      }

      // Logout (ou outro login) enquanto o refresh estava no ar: não
      // ressuscita a sessão que acabou de ser encerrada.
      if (_refreshToken != refreshToken) return RefreshResult.invalid;

      _token = accessToken;
      _refreshToken = nextRefreshToken;
      // O refresh token anterior deixou de valer no servidor: se o app fechar
      // sem gravar o novo, a próxima abertura cai no login.
      await AuthStorageService.saveTokens(
        accessToken: accessToken,
        refreshToken: nextRefreshToken,
      );
      return RefreshResult.refreshed;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 401 || status == 403) {
        if (_refreshToken == refreshToken) _refreshToken = null;
        return RefreshResult.invalid;
      }
      return RefreshResult.unavailable;
    }
  }

  /// Encerra a sessão local e avisa o servidor, sem esperar a resposta: sem
  /// rede, o refresh token esquecido no servidor vence sozinho.
  static Future<void> logout() async {
    final refreshToken = _refreshToken;
    clearSession();
    if (refreshToken == null) return;

    try {
      await sessionDio.post(
        ApiEndpoints.logout(),
        data: {'refreshToken': refreshToken},
      );
    } catch (_) {
      // Melhor esforço.
    }
  }

  static void _notifySessionExpired() {
    if (_sessionExpiredNotified) return;
    _sessionExpiredNotified = true;
    onSessionExpired?.call();
  }

  // 401 de /auth/* é credencial errada (login, senha na exclusão de conta),
  // não sessão vencida. E só conta se a requisição levou token: sem token não
  // havia sessão a perder.
  static bool _isAuthFailure(DioException error) {
    if (error.response?.statusCode != 401) return false;
    if (error.requestOptions.headers['Authorization'] == null) return false;
    return !error.requestOptions.uri.path.startsWith('/auth/');
  }

  /// Lê o `exp` do JWT sem validar assinatura — só para decidir se vale
  /// renovar antes de usar. [margin] antecipa o vencimento. Token ilegível
  /// conta como vencido.
  static bool isTokenExpired(String token, {Duration margin = Duration.zero}) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return true;
      final payload = jsonDecode(
        utf8.decode(base64Url.decode(base64Url.normalize(parts[1]))),
      );
      final exp = payload is Map ? payload['exp'] : null;
      if (exp is! num) return false;
      final expiresAt = DateTime.fromMillisecondsSinceEpoch(exp.toInt() * 1000);
      return DateTime.now().add(margin).isAfter(expiresAt);
    } catch (_) {
      return true;
    }
  }
}
