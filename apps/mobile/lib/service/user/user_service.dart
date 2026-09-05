import 'dart:io';
import 'package:dio/dio.dart';
import 'package:email_validator/email_validator.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';

class UploadUrlResult {
  final String uploadUrl;
  final String key;
  final String publicUrl;

  UploadUrlResult({
    required this.uploadUrl,
    required this.key,
    required this.publicUrl,
  });

  factory UploadUrlResult.fromJson(Map<String, dynamic> json) {
    return UploadUrlResult(
      uploadUrl: json['uploadUrl'] ?? '',
      key: json['key'] ?? '',
      publicUrl: json['publicUrl'] ?? '',
    );
  }
}

class UserService {
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
      final mensagem = e.response?.data?['message'] ?? 'Erro ao criar conta';
      throw Exception(mensagem);
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
      final mensagem = e.response?.data?['message'] ?? 'Erro ao fazer login';
      throw Exception(mensagem);
    }
  }

  // Busca o perfil completo do usuário pelo id
  Future<Map<String, dynamic>> getProfile(String id) async {
    try {
      final response = await ApiClient.dio.get(ApiEndpoints.getProfileById(id));
      return response.data;
    } on DioException catch (e) {
      final mensagem = e.response?.data?['message'] ?? 'Erro ao buscar perfil';
      throw Exception(mensagem);
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
      final mensagem = e.response?.data?['message'] ?? 'Erro ao atualizar nome';
      throw Exception(mensagem);
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
      final mensagem = e.response?.data?['message'] ?? 'Erro ao atualizar bio';
      throw Exception(mensagem);
    }
  }

  Future<Map<String, dynamic>> updateAvatar({
    required String accountId,
    required File image,
  }) async {
    try {
      final imageUrls = await _uploadImages(userId: accountId, images: [image]);

      final avatarUrl = imageUrls.first;

      final response = await ApiClient.dio.put(
        ApiEndpoints.updateAvatar(),
        data: {'accountId': accountId, 'avatarUrl': avatarUrl},
      );

      return response.data;
    } on DioException catch (e) {
      final mensagem =
          e.response?.data?['message'] ?? 'Erro ao atualizar avatar';

      throw Exception(mensagem);
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
      final mensagem = e.response?.data?['message'] ?? 'Erro ao seguir usuário';
      throw Exception(mensagem);
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
      final mensagem =
          e.response?.data?['message'] ?? 'Erro ao verificar status de seguir';
      throw Exception(mensagem);
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
      final mensagem =
          e.response?.data?['message'] ?? 'Erro ao deixar de seguir usuário';
      throw Exception(mensagem);
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
      final mensagem =
          e.response?.data?['message'] ??
          'Erro ao gerar link de compartilhamento';
      throw Exception(mensagem);
    }
  }

  // Retorna o accountId do perfil apontado pelo token, ou null se o link
  // estiver expirado/inválido (404 do backend).
  Future<String?> resolveShareToken(String token) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.resolveShareLink(token),
      );
      return response.data['accountId'] as String?;
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      final mensagem =
          e.response?.data?['message'] ??
          'Erro ao abrir link de compartilhamento';
      throw Exception(mensagem);
    }
  }

  Future<List<UploadUrlResult>> _getUploadUrls({
    required String userId,
    required int count,
  }) async {
    try {
      final response = await ApiClient.dio.post(
        ApiEndpoints.postsUploadUrl(),
        data: {'userId': userId, 'count': count},
      );
      final List data = response.data;
      return data.map((json) => UploadUrlResult.fromJson(json)).toList();
    } on DioException catch (e) {
      final mensagem =
          e.response?.data?['message'] ?? 'Erro ao gerar URLs de upload';
      throw Exception(mensagem);
    }
  }

  Future<void> _uploadToR2(String uploadUrl, File file) async {
    final dio = Dio(); // instância separada: sem Authorization da sua API
    final bytes = await file.readAsBytes();
    final extensao = file.path.split('.').last.toLowerCase();
    final contentType = extensao == 'png' ? 'image/png' : 'image/jpeg';

    await dio.put(
      uploadUrl,
      data: bytes,
      options: Options(
        headers: {
          Headers.contentLengthHeader: bytes.length,
          'Content-Type': contentType,
        },
      ),
    );
  }

  Future<List<String>> _uploadImages({
    required String userId,
    required List<File> images,
  }) async {
    if (images.isEmpty) return [];

    final uploadUrls = await _getUploadUrls(
      userId: userId,
      count: images.length,
    );

    final publicUrls = <String>[];
    for (var i = 0; i < images.length; i++) {
      await _uploadToR2(uploadUrls[i].uploadUrl, images[i]);
      publicUrls.add(_normalizeUrl(uploadUrls[i].publicUrl));
    }
    return publicUrls;
  }

  String _normalizeUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return 'https://$url';
  }

  Future<List<UserSearchResult>> searchUsers(String q, {int limit = 10}) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.searchUsers(q, limit: limit),
      );
      final data = response.data['data'] as List;
      return data.map((json) => UserSearchResult.fromJson(json)).toList();
    } on DioException catch (e) {
      final mensagem =
          e.response?.data?['message'] ?? 'Erro ao pesquisar usuários';
      throw Exception(mensagem);
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
      final mensagem =
          e.response?.data?['message'] ?? 'Código inválido ou expirado';
      throw Exception(mensagem);
    }
  }
}
