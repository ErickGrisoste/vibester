import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/models/user/user_model.dart';

class AuthStorageService {
  static const _storage = FlutterSecureStorage();
  static const _sessionKey = 'user_session';
  static const _onboardingKey = 'onboarding_pendente';

  static Future<void> saveSession(UserModel user) async {
    final json = jsonEncode({
      'token': user.token,
      'accountId': user.accountId,
      'id': user.id,
      'userID': user.userID,
      'nome': user.nome,
      'nomeUsuario': user.nomeUsuario,
      'bio': user.bio,
      'fotoPerfil': user.fotoPerfil,
      'seguidores': user.seguidores,
      'seguindo': user.seguindo,
      'totalPosts': user.totalPosts,
      'createdAt': user.createdAt,
      'updatedAt': user.updatedAt,
    });
    await _storage.write(key: _sessionKey, value: json);
  }

  static Future<UserModel?> loadSession() async {
    try {
      final json = await _storage.read(key: _sessionKey);
      if (json == null) return null;
      final map = jsonDecode(json) as Map<String, dynamic>;
      if (map['token'] == null) return null;
      return UserModel(
        token: map['token'] as String,
        accountId: map['accountId'] as String?,
        id: map['id'] as String?,
        userID: map['userID'] as String?,
        nome: (map['nome'] as String?) ?? '',
        nomeUsuario: (map['nomeUsuario'] as String?) ?? '',
        bio: (map['bio'] as String?) ?? '',
        fotoPerfil: (map['fotoPerfil'] as String?) ?? '',
        seguidores: (map['seguidores'] as int?) ?? 0,
        seguindo: (map['seguindo'] as int?) ?? 0,
        totalPosts: (map['totalPosts'] as int?) ?? 0,
        email: '',
        dataNascimento: '',
        createdAt: (map['createdAt'] as String?) ?? '',
        updatedAt: (map['updatedAt'] as String?) ?? '',
      );
    } catch (_) {
      return null;
    }
  }

  /// Marcado ao entrar no onboarding e apagado no "Comecar". Se o usuario
  /// fechar o app no meio, a marca sobrevive e ele volta para o onboarding.
  /// Contas antigas nunca tiveram a chave gravada, entao continuam indo
  /// direto para a home.
  static Future<void> marcarOnboardingPendente() async {
    await _storage.write(key: _onboardingKey, value: 'true');
  }

  static Future<void> concluirOnboarding() async {
    await _storage.delete(key: _onboardingKey);
  }

  static Future<bool> onboardingPendente() async {
    return await _storage.read(key: _onboardingKey) == 'true';
  }

  static Future<void> clearSession() async {
    await _storage.delete(key: _sessionKey);
    await _storage.delete(key: _onboardingKey);
  }
}