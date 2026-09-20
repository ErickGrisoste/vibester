import 'package:dio/dio.dart';
import 'package:mobile/models/interaction/interaction_event_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';

/// Envio dos sinais implícitos ao interaction-service.
///
/// A rota responde **202**: o lote foi aceito, a persistência é assíncrona. Não
/// há resposta útil para o app — telemetria é mão única.
class InteractionService {
  Future<void> sendBatch({
    required String sessionId,
    required List<InteractionEvent> events,
  }) async {
    try {
      await ApiClient.dio.post(
        ApiEndpoints.interactions(),
        data: {
          'sessionId': sessionId,
          'events': events.map((event) => event.toJson()).toList(),
        },
      );
    } on DioException catch (e) {
      final mensagem =
          e.response?.data?['message'] ?? 'Erro ao enviar interações';
      throw Exception(mensagem);
    }
  }
}
