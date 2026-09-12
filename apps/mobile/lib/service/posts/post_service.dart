import 'package:dio/dio.dart';
import 'package:mobile/models/media/media_item.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';
import 'package:mobile/service/media_upload_service.dart';

class PostService {
  final MediaUploadService _mediaUpload = MediaUploadService();

  Future<void> createPost({
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
      await ApiClient.dio.post(
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

  String? _nonEmpty(String? value) =>
      value == null || value.trim().isEmpty ? null : value;
}
