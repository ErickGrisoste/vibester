import 'package:dio/dio.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';

class CloseToYouService {
  // Busca estabelecimentos próximos
  Future<List<PlaceModel>> getEstablishmentsNearby({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.establishmentsNearby(
          latitude: latitude,
          longitude: longitude,
          radiusKm: 15,
        ),
      );
      final List data = response.data;
      return data.map((json) => PlaceModel.fromJson(json)).toList();
    } on DioException catch (e) {
      final mensagem =
          e.response?.data?['message'] ??
          'Erro ao buscar estabelecimentos próximos';
      throw Exception(mensagem);
    }
  }
}
