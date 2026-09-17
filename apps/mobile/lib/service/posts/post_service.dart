import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/models/media/media_item.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';
import 'package:mobile/service/media_upload_service.dart';

class PostService {
  final MediaUploadService _mediaUpload = MediaUploadService();

  /// Devolve o post criado, para o feed exibi-lo na hora — ou `null` se a
  /// resposta não trouxer o corpo esperado (o post foi criado mesmo assim).
  Future<PublicationModel?> createPost({
    required String userId,
    required String userUsername,
    required String userProfilePicture,
    required bool userVerified,
    required String caption,
    required List<MediaItem> media,
    String? establishmentId,
    String? establishmentName,
    String? establishmentLogo,
    String? establishmentCategory,
  }) async {
    final uploaded = await _mediaUpload.upload(userId: userId, items: media);

    try {
      final response = await ApiClient.dio.post(
        ApiEndpoints.posts(),
        data: {
          'userId': userId,
          // O post-service valida `userProfilePicture`/`establishmentLogo`
          // como URI e `userUsername` com tamanho mínimo: string vazia (usuário
          // sem avatar, lugar sem foto) derrubava a publicação com 400. Campo
          // sem valor não vai no corpo.
          'userUsername': ?_nonEmpty(userUsername),
          'userProfilePicture': ?_nonEmpty(userProfilePicture),
          'userVerified': userVerified,
          'caption': caption,
          'media': [for (final item in uploaded) item.toJson()],
          'establishmentId': ?_nonEmpty(establishmentId),
          'establishmentName': ?_nonEmpty(establishmentName),
          'establishmentLogo': ?_nonEmpty(establishmentLogo),
          'establishmentCategory': ?_nonEmpty(establishmentCategory),
        },
      );
      return _parseCreated(response.data);
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao publicar post'));
    }
  }

  Future<void> likePost({
    required String postId,
    required String userId,
  }) async {
    try {
      await ApiClient.dio.post(
        ApiEndpoints.likePost(postId),
        data: {'userId': userId},
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao curtir post'));
    }
  }

  Future<void> unlikePost({
    required String postId,
    required String userId,
  }) async {
    try {
      await ApiClient.dio.delete(
        ApiEndpoints.likePost(postId),
        data: {'userId': userId},
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao descurtir post'));
    }
  }

  /// Soft delete no post-service. Só o dono consegue: o serviço compara o
  /// `userId` do corpo com o autor e responde 403 para qualquer outro.
  /// 404 conta como sucesso — o post já não existe, que é o estado desejado
  /// (ex.: exclusão repetida por um toque duplo ou outra tela).
  Future<void> deletePost({
    required String postId,
    required String userId,
  }) async {
    try {
      await ApiClient.dio.delete(
        ApiEndpoints.post(postId),
        data: {'userId': userId},
      );
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return;
      throw Exception(apiErrorMessage(e, 'Erro ao excluir post'));
    }
  }

  /// O post já existe quando isto roda: corpo inesperado não pode virar erro
  /// na tela, senão a pessoa tenta de novo e publica duas vezes.
  PublicationModel? _parseCreated(Object? body) {
    if (body is! Map<String, dynamic> || body['postId'] is! String) return null;
    try {
      return PublicationModel.fromPost(body);
    } catch (e) {
      debugPrint('Post criado, mas a resposta não pôde ser lida: $e');
      return null;
    }
  }

  String? _nonEmpty(String? value) =>
      value == null || value.trim().isEmpty ? null : value;
}
