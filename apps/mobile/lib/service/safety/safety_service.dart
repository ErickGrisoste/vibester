import 'package:dio/dio.dart';
import 'package:mobile/models/safety/blocked_profile.dart';
import 'package:mobile/models/safety/report_reason.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';

/// Bloqueio e denúncia (user-service).
///
/// Nenhum método recebe o id de quem está agindo: o backend tira isso do JWT.
class SafetyService {
  Future<void> block(String accountId) async {
    try {
      await ApiClient.dio.post(
        ApiEndpoints.blocks(),
        data: {'blockedId': accountId},
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Não foi possível bloquear agora'));
    }
  }

  Future<void> unblock(String accountId) async {
    try {
      await ApiClient.dio.delete(ApiEndpoints.block(accountId));
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Não foi possível desbloquear agora'));
    }
  }

  Future<BlockStatus> status(String accountId) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.blockStatus(accountId),
      );
      return BlockStatus.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao verificar bloqueio'));
    }
  }

  Future<BlockedProfilesPage> listBlocked({String? cursor, int limit = 50}) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.blocks(),
        queryParameters: {'limit': limit, 'cursor': ?cursor},
      );
      return BlockedProfilesPage.fromJson(response.data as Map<String, dynamic>);
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao carregar contas bloqueadas'));
    }
  }

  /// Envia a denúncia. Denunciar o mesmo alvo de novo não é erro: o backend
  /// só não duplica.
  Future<void> report({
    required ReportTargetType targetType,
    required String targetId,
    String? targetOwnerId,
    required ReportReason reason,
    String? details,
  }) async {
    final detalhes = details?.trim();
    try {
      await ApiClient.dio.post(
        ApiEndpoints.reports(),
        data: {
          'targetType': targetType.apiValue,
          'targetId': targetId,
          'targetOwnerId': ?targetOwnerId,
          'reason': reason.apiValue,
          if (detalhes != null && detalhes.isNotEmpty) 'details': detalhes,
        },
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Não foi possível enviar a denúncia'));
    }
  }
}
