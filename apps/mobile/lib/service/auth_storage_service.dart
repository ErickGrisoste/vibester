import 'dart:convert';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:mobile/models/user/user_model.dart';

/// Passo do cadastro que o usuário ainda não concluiu.
///
/// A conta nasce no `EmailConfirmScreen`, mas o cadastro só termina depois de
/// perfil, interesses e apresentação. Entre esses dois momentos existe um
/// estado — "tem conta, cadastro inacabado" — que o app não sabia nomear: ele
/// conhecia só "sem conta", "onboarding pendente" e "pronto". Fechar o app na
/// edição de perfil caía na home com o cadastro pela metade, para sempre.
///
/// Cada passo grava a etapa seguinte **antes** de navegar. Como o fluxo
/// descarta a pilha a cada passo, esta marca é a única memória de onde o
/// usuário parou; gravando depois, um encerramento naquele instante deixaria
/// o cadastro órfão. Gravando antes, o pior caso é reabrir um passo atrás.
enum EtapaCadastro {
  perfil,
  interesses,
  apresentacao;

  static EtapaCadastro? porNome(String? nome) {
    for (final etapa in EtapaCadastro.values) {
      if (etapa.name == nome) return etapa;
    }
    return null;
  }
}

class AuthStorageService {
  static const _storage = FlutterSecureStorage();
  static const _sessionKey = 'user_session';
  static const _etapaKey = 'etapa_cadastro';

  /// Chave da versão anterior, que só marcava a apresentação.
  ///
  /// Mantida apenas para leitura: quem atualizar o app no meio do onboarding
  /// tem esta gravada e nenhuma etapa. Sem a conversão, essas contas cairiam
  /// direto na home e nunca mais veriam a apresentação.
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

  /// Grava o passo em que o cadastro está. Chamar antes de navegar.
  static Future<void> marcarEtapa(EtapaCadastro etapa) async {
    await _storage.write(key: _etapaKey, value: etapa.name);
  }

  /// Etapa em aberto, ou `null` se não há cadastro pela metade.
  ///
  /// Contas antigas nunca gravaram nenhuma das duas chaves e continuam indo
  /// direto para a home.
  static Future<EtapaCadastro?> etapaPendente() async {
    final etapa = EtapaCadastro.porNome(await _storage.read(key: _etapaKey));
    if (etapa != null) return etapa;

    if (await _storage.read(key: _onboardingKey) == 'true') {
      return EtapaCadastro.apresentacao;
    }
    return null;
  }

  /// Cadastro terminado: some com a marca dos dois formatos.
  static Future<void> concluirCadastro() async {
    await _storage.delete(key: _etapaKey);
    await _storage.delete(key: _onboardingKey);
  }

  static Future<void> clearSession() async {
    await _storage.delete(key: _sessionKey);
    await _storage.delete(key: _etapaKey);
    await _storage.delete(key: _onboardingKey);
  }
}