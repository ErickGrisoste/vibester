import 'package:dio/dio.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';

class PlaceService {
  Future<List<PlaceModel>> getPlaces() async {
    try {
      final response = await ApiClient.dio.get(ApiEndpoints.establishments());
      return _parsePage(response.data);
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao buscar estabelecimentos'));
    }
  }

  Future<List<PlaceModel>> getPlacesByCategory(String category) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.establishmentsByCategory(category),
      );
      return _parsePage(response.data);
    } on DioException catch (e) {
      throw Exception(
        apiErrorMessage(e, 'Erro ao buscar estabelecimentos por categoria'),
      );
    }
  }

  Future<PlaceModel> getPlaceById(String id) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.establishmentDetail(id),
      );
      return PlaceModel.fromJson(response.data);
    } on DioException catch (e) {
      throw Exception(
        apiErrorMessage(e, 'Erro ao buscar perfil do estabelecimento'),
      );
    }
  }

  // GET /establishments é paginado: com ou sem filtro de categoria a resposta
  // é `{ data: [...], pagination: {...} }`, nunca uma lista crua.
  List<PlaceModel> _parsePage(dynamic body) {
    final List data = body['data'];
    return data.map((json) => PlaceModel.fromJson(json)).toList();
  }

  /// MOCK temporário: o establishment-service ainda não expõe um endpoint de
  /// fotos do ambiente (fachada, decoração, pista) separado das publicações
  /// de usuários. Enquanto não existir, devolve um conjunto fixo por
  /// [placeId] para a aba AMBIENTE poder ser desenvolvida e revisada.
  /// Assinatura já pronta para virar uma chamada real (`GET
  /// /establishment/{id}/photos` ou equivalente) sem alterar quem a chama.
  Future<List<String>> getAmbiencePhotos(String placeId) async {
    await Future.delayed(const Duration(milliseconds: 400));
    return List.generate(
      8,
      (i) => 'https://picsum.photos/seed/vibester-ambience-$placeId-$i/900/1200',
    );
  }
}
