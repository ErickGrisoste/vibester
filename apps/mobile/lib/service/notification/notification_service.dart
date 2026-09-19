import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:mobile/models/notification/notification_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';

/// Acesso ao notification-service.
///
/// **Por que o parsing aqui é defensivo.** A leitura anterior era
/// `response.data['items']` e `response.data['count']` direto. Duas coisas
/// davam errado em silêncio:
///
/// * Se o corpo não fosse um `Map` — array puro, ou texto do Traefik quando
///   não há pod saudável na rota — indexar com `String` lança `TypeError`,
///   que **não** é `DioException` e portanto passava reto pelo `on
///   DioException` daqui, subindo cru até o `catch` genérico do provider.
/// * Se o envelope mudasse de nome (`notifications`, `data.items`,
///   `unreadCount`), a leitura devolvia `null` → lista vazia e contador zero.
///   Ou seja: uma falha real e "você não tem notificações" produziam
///   exatamente a mesma tela, e não havia como distinguir as duas sem
///   inspecionar a rede por fora.
///
/// Agora todo caminho de erro deixa rastro no log de debug com o que o
/// servidor realmente respondeu, e o formato é lido por tentativa em vez de
/// por chave fixa.
class NotificationService {
  Future<List<NotificationModel>> getNotifications(String userId) async {
    final url = ApiEndpoints.notifications(userId);

    try {
      final response = await ApiClient.dio.get(url);
      final raw = _extractList(response.data);

      if (raw == null) {
        debugPrint(
          '[notifications] formato inesperado em GET $url — '
          'tipo: ${response.data.runtimeType}, corpo: ${response.data}',
        );
        throw Exception('Resposta em formato inesperado');
      }

      final notifications = <NotificationModel>[];
      for (final item in raw) {
        if (item is! Map<String, dynamic>) {
          debugPrint('[notifications] item ignorado (não é objeto): $item');
          continue;
        }
        try {
          notifications.add(NotificationModel.fromJson(item));
        } catch (e) {
          // Um item malformado não derruba a lista inteira: o resto das
          // notificações continua chegando na tela.
          debugPrint('[notifications] item ignorado por erro de parse: $e');
        }
      }

      debugPrint('[notifications] ${notifications.length} item(ns) recebidos');
      return notifications;
    } on DioException catch (e) {
      debugPrint(
        '[notifications] falha em GET $url — '
        'status: ${e.response?.statusCode}, corpo: ${e.response?.data}',
      );
      throw Exception(apiErrorMessage(e, 'Erro ao buscar notificações'));
    }
  }

  Future<int> getUnreadCount(String userId) async {
    final url = ApiEndpoints.notificationsUnreadCount(userId);

    try {
      final response = await ApiClient.dio.get(url);
      final count = _extractCount(response.data);

      if (count == null) {
        debugPrint(
          '[notifications] contador em formato inesperado em GET $url — '
          'tipo: ${response.data.runtimeType}, corpo: ${response.data}',
        );
        throw Exception('Resposta em formato inesperado');
      }

      debugPrint('[notifications] contador de não lidas: $count');
      return count;
    } on DioException catch (e) {
      debugPrint(
        '[notifications] falha em GET $url — '
        'status: ${e.response?.statusCode}, corpo: ${e.response?.data}',
      );
      throw Exception(apiErrorMessage(e, 'Erro ao buscar notificações'));
    }
  }

  Future<void> markAllRead(String userId) async {
    final url = ApiEndpoints.notificationsMarkRead(userId);

    try {
      await ApiClient.dio.patch(url);
      debugPrint('[notifications] marcadas como lidas');
    } on DioException catch (e) {
      debugPrint(
        '[notifications] falha em PATCH $url — '
        'status: ${e.response?.statusCode}, corpo: ${e.response?.data}',
      );
      throw Exception(
        apiErrorMessage(e, 'Erro ao marcar notificações como lidas'),
      );
    }
  }

  /// Encontra a lista de notificações no corpo da resposta.
  ///
  /// Aceita array puro, `{items: [...]}`, `{notifications: [...]}` e
  /// qualquer um dos dois embrulhado em `{data: ...}`. Devolve `null` quando
  /// não há lista nenhuma — o que é diferente de uma lista vazia, e por isso
  /// vira log em vez de "nenhuma notificação".
  List<dynamic>? _extractList(dynamic data) {
    if (data is List) return data;

    if (data is Map) {
      for (final key in const ['items', 'notifications', 'results']) {
        final value = data[key];
        if (value is List) return value;
      }
      // Envelope `{ data: { items: [...] } }` ou `{ data: [...] }`.
      if (data['data'] != null) return _extractList(data['data']);
    }

    return null;
  }

  /// Mesma ideia para o contador: aceita número cru, string numérica e as
  /// chaves usadas pelos serviços (`count`, `unreadCount`, `total`), com ou
  /// sem envelope `data`.
  int? _extractCount(dynamic data) {
    if (data is int) return data;
    if (data is num) return data.toInt();
    if (data is String) return int.tryParse(data.trim());

    if (data is Map) {
      for (final key in const ['count', 'unreadCount', 'unread', 'total']) {
        final value = data[key];
        if (value == null) continue;
        final parsed = _extractCount(value);
        if (parsed != null) return parsed;
      }
      if (data['data'] != null) return _extractCount(data['data']);
    }

    return null;
  }
}