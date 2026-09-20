/// Uma pessoa na lista de seguidores ou de seguidos
/// (`GET /user/users/:accountId/followers|following`).
///
/// O backend já devolve o perfil hidratado (nome, @, avatar e o contador de
/// seguidores **dela**), então a tela monta a lista sem buscar perfil por
/// item. Perfil ainda não criado chega com os campos nulos, e não some da
/// lista — é o que mantém o cursor consistente do outro lado.
class FollowProfile {
  final String accountId;
  final String nome;
  final String nomeUsuario;
  final String fotoPerfil;

  /// Quantas pessoas seguem *esta* pessoa — o mesmo dado exibido na busca.
  final int seguidores;

  /// Quando o follow aconteceu. É também o cursor da próxima página.
  final DateTime? seguidoEm;

  const FollowProfile({
    required this.accountId,
    this.nome = '',
    this.nomeUsuario = '',
    this.fotoPerfil = '',
    this.seguidores = 0,
    this.seguidoEm,
  });

  factory FollowProfile.fromJson(Map<String, dynamic> json) => FollowProfile(
    accountId: json['accountId'] as String? ?? '',
    nome: json['name'] as String? ?? '',
    nomeUsuario: json['username'] as String? ?? '',
    fotoPerfil: json['avatarUrl'] as String? ?? '',
    seguidores: json['followers'] as int? ?? 0,
    seguidoEm: DateTime.tryParse(json['followedAt'] as String? ?? ''),
  );
}

/// Uma página da listagem. `nextCursor` nulo significa fim da lista.
class FollowProfilesPage {
  final List<FollowProfile> perfis;
  final String? nextCursor;

  const FollowProfilesPage({required this.perfis, this.nextCursor});

  static const empty = FollowProfilesPage(perfis: []);

  factory FollowProfilesPage.fromJson(Map<String, dynamic> json) =>
      FollowProfilesPage(
        perfis: [
          for (final item in (json['data'] as List? ?? const []))
            if (item is Map<String, dynamic>) FollowProfile.fromJson(item),
        ],
        nextCursor: json['nextCursor'] as String?,
      );
}
