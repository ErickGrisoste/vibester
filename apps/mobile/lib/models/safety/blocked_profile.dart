/// Perfil na lista de contas bloqueadas (`GET /user/users/blocks`).
class BlockedProfile {
  final String accountId;
  final String nome;
  final String nomeUsuario;
  final String fotoPerfil;
  final DateTime? bloqueadoEm;

  const BlockedProfile({
    required this.accountId,
    this.nome = '',
    this.nomeUsuario = '',
    this.fotoPerfil = '',
    this.bloqueadoEm,
  });

  factory BlockedProfile.fromJson(Map<String, dynamic> json) => BlockedProfile(
    accountId: json['accountId'] as String? ?? '',
    nome: json['name'] as String? ?? '',
    nomeUsuario: json['username'] as String? ?? '',
    fotoPerfil: json['avatarUrl'] as String? ?? '',
    bloqueadoEm: DateTime.tryParse(json['blockedAt'] as String? ?? ''),
  );
}

class BlockedProfilesPage {
  final List<BlockedProfile> perfis;
  final String? nextCursor;

  const BlockedProfilesPage({required this.perfis, this.nextCursor});

  factory BlockedProfilesPage.fromJson(Map<String, dynamic> json) =>
      BlockedProfilesPage(
        perfis: [
          for (final item in (json['data'] as List? ?? const []))
            if (item is Map<String, dynamic>) BlockedProfile.fromJson(item),
        ],
        nextCursor: json['nextCursor'] as String?,
      );
}

/// Situação de bloqueio entre o usuário logado e outro perfil.
class BlockStatus {
  /// O usuário logado bloqueou o perfil.
  final bool bloqueando;

  /// O perfil bloqueou o usuário logado.
  final bool bloqueadoPor;

  const BlockStatus({this.bloqueando = false, this.bloqueadoPor = false});

  static const none = BlockStatus();

  factory BlockStatus.fromJson(Map<String, dynamic> json) => BlockStatus(
    bloqueando: json['blocking'] == true,
    bloqueadoPor: json['blockedBy'] == true,
  );
}
