import 'package:dio/dio.dart';
import 'package:email_validator/email_validator.dart';
import 'package:mobile/models/media/media_item.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';
import 'package:mobile/service/media_upload_service.dart';

class UserService {
  final MediaUploadService _mediaUpload = MediaUploadService();

  Future<void> register({
    required String name,
    required String username,
    required String email,
    required String password,
    required String bornAt,
  }) async {
    try {
      await ApiClient.dio.post(
        ApiEndpoints.register(),
        data: {
          'name': name,
          'username': username,
          'email': email,
          'password': password,
          'bornAt': bornAt,
        },
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao criar conta'));
    }
  }

  Future<Map<String, dynamic>> login({
    required String emailOuUsername,
    required String password,
  }) async {
    final ehEmail = EmailValidator.validate(emailOuUsername);

    try {
      final response = await ApiClient.dio.post(
        ApiEndpoints.login(),
        data: {
          if (ehEmail)
            'email': emailOuUsername
          else
            'username': emailOuUsername,
          'password': password,
        },
      );

      return response.data;
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao fazer login'));
    }
  }

  // Busca o perfil completo do usuário pelo id
  Future<Map<String, dynamic>> getProfile(String id) async {
    try {
      final response = await ApiClient.dio.get(ApiEndpoints.getProfileById(id));
      return response.data;
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao buscar perfil'));
    }
  }

  // Atualiza nome e username
  Future<Map<String, dynamic>> updateName({
    required String accountId,
    required String name,
    required String username,
  }) async {
    try {
      final response = await ApiClient.dio.put(
        ApiEndpoints.updateInfo(),
        data: {'accountId': accountId, 'name': name, 'username': username},
      );
      return response.data;
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao atualizar nome'));
    }
  }

  // Atualiza a bio do usuário
  Future<Map<String, dynamic>> updateBio({
    required String accountId,
    required String bio,
  }) async {
    try {
      final response = await ApiClient.dio.put(
        ApiEndpoints.updateBio(),
        data: {'accountId': accountId, 'bio': bio},
      );
      return response.data;
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao atualizar bio'));
    }
  }

  Future<Map<String, dynamic>> updateAvatar({
    required String accountId,
    required MediaItem image,
  }) async {
    try {
      final uploaded = await _mediaUpload.upload(
        userId: accountId,
        items: [image],
      );

      final avatarUrl = uploaded.first.url;

      final response = await ApiClient.dio.put(
        ApiEndpoints.updateAvatar(),
        data: {'accountId': accountId, 'avatarUrl': avatarUrl},
      );

      return response.data;
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao atualizar avatar'));
    }
  }

  Future<void> followUser({
    required String followerId,
    required String followingId,
  }) async {
    try {
      await ApiClient.dio.post(
        ApiEndpoints.increaseFollowers(),
        data: {'followerId': followerId, 'followingId': followingId},
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao seguir usuário'));
    }
  }

  Future<bool> isFollowing({
    required String followerId,
    required String followingId,
  }) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.checkFollowing(followerId, followingId),
      );
      return response.data['isFollowing'] ?? false;
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao verificar status de seguir'));
    }
  }

  Future<void> unfollowUser({
    required String followerId,
    required String followingId,
  }) async {
    try {
      await ApiClient.dio.post(
        ApiEndpoints.decreaseFollowers(),
        data: {'followerId': followerId, 'followingId': followingId},
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao deixar de seguir usuário'));
    }
  }

  Future<String> generateShareLink(String accountId) async {
    try {
      final response = await ApiClient.dio.post(
        ApiEndpoints.generateShareLink(),
        data: {'accountId': accountId},
      );
      return response.data['shareUrl'] as String;
    } on DioException catch (e) {
      throw Exception(
        apiErrorMessage(e, 'Erro ao gerar link de compartilhamento'),
      );
    }
  }

  // Retorna o accountId do perfil apontado pelo token, ou null se o link
  // estiver expirado (404) ou malformado (400: o token não é um UUID).
  Future<String?> resolveShareToken(String token) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.resolveShareLink(token),
      );
      return response.data['accountId'] as String?;
    } on DioException catch (e) {
      final status = e.response?.statusCode;
      if (status == 404 || status == 400) return null;
      throw Exception(
        apiErrorMessage(e, 'Erro ao abrir link de compartilhamento'),
      );
    }
  }

  Future<List<UserSearchResult>> searchUsers(String q, {int limit = 10}) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.searchUsers(q, limit: limit),
      );
      final data = response.data['data'] as List;
      return data.map((json) => UserSearchResult.fromJson(json)).toList();
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao pesquisar usuários'));
    }
  }

  Future<void> verifyEmail({
    required String email,
    required String code,
  }) async {
    try {
      await ApiClient.dio.post(
        ApiEndpoints.verifyEmail(),
        data: {'email': email, 'code': code},
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Código inválido ou expirado'));
    }
  }
}
