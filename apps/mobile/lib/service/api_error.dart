import 'package:dio/dio.dart';

/// Converte uma [DioException] na mensagem que pode ir para a tela.
///
/// Os serviços não concordam na chave do erro: a maioria usa `message`, mas o
/// auth-service e o payment-service respondem `{ "error": "..." }` — lendo só
/// `message`, o app escondia "Usuário ou senha inválidos" atrás de um genérico.
///
/// O corpo também nem sempre é JSON: quando o Traefik não tem pod saudável
/// para a rota ele responde `no available server` (503) ou `404 page not
/// found` em texto puro, e o R2 responde XML. Indexar uma `String` com
/// `['message']` lança `TypeError` de dentro do próprio `catch`, e aí a
/// exceção crua subia até a tela.
///
/// Em 5xx a mensagem do servidor é descartada: é texto interno, em inglês
/// ("Error fetching profile", "Internal server error"), e não orienta o
/// usuário a nada além de tentar de novo.
String apiErrorMessage(DioException e, String fallback) {
  switch (e.type) {
    case DioExceptionType.connectionTimeout:
    case DioExceptionType.sendTimeout:
    case DioExceptionType.receiveTimeout:
    case DioExceptionType.connectionError:
      return 'Sem conexão com o servidor. Tenta de novo em instantes.';
    default:
      break;
  }

  final status = e.response?.statusCode;
  if (status != null && status >= 500) {
    return 'Serviço indisponível no momento. Tenta de novo em instantes.';
  }

  final data = e.response?.data;
  if (data is Map) {
    final message = data['message'] ?? data['error'];
    if (message is String && message.trim().isNotEmpty) return message;
  }

  if (status == 429) return 'Muitas tentativas seguidas. Espera um pouco.';
  return fallback;
}
