import 'package:dio/dio.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';

class HighlightsService {
  // Busca os posts de um usuário pelo accountId
  // viewerId é o usuário logado, usado pelo backend pra calcular isLiked
  Future<List<HighlightModel>> getHighlightsByAccountId(
    String accountId, {
    String? viewerId,
  }) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.userPosts(accountId),
        queryParameters: viewerId != null ? {'viewerId': viewerId} : null,
      );
      final List data = response.data;
      return data.map((json) => HighlightModel.fromJson(json)).toList();
    } on DioException catch (e) {
      final mensagem =
          e.response?.data?['message'] ?? 'Erro ao buscar destaques';
      throw Exception(mensagem);
    }
  }

  // Busca os posts de um estabelecimento pelo establishmentId
  Future<List<HighlightModel>> getHighlightsByEstablishmentId(
    String establishmentId, {
    String? viewerId,
  }) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.establishmentPosts(establishmentId),
        queryParameters: viewerId != null ? {'viewerId': viewerId} : null,
      );
      final List data = response.data;
      return data.map((json) => HighlightModel.fromJson(json)).toList();
    } on DioException catch (e) {
      final mensagem =
          e.response?.data?['message'] ?? 'Erro ao buscar destaques';
      throw Exception(mensagem);
    }
  }
}
