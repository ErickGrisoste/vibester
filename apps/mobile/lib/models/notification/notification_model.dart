class NotificationModel {
  final String id;
  final String tipo; // like | comment | follow | post_rejected
  final String? referenciaId;
  final int outrosCount;
  final int totalCount;
  final String conteudo;
  final bool lida;
  final DateTime criadoEm;

  final String? atorNome;
  final String? atorUsername;
  final String? atorAvatarUrl;

  final String? postImagemUrl;
  final String? postLegenda;
  final bool postApagado;

  NotificationModel({
    required this.id,
    required this.tipo,
    this.referenciaId,
    required this.outrosCount,
    required this.totalCount,
    required this.conteudo,
    required this.lida,
    required this.criadoEm,
    this.atorNome,
    this.atorUsername,
    this.atorAvatarUrl,
    this.postImagemUrl,
    this.postLegenda,
    this.postApagado = false,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    final ator = json['actor'] as Map<String, dynamic>?;
    final post = json['post'] as Map<String, dynamic>?;

    return NotificationModel(
      id: json['id'] ?? '',
      tipo: json['type'] ?? '',
      referenciaId: json['refId'],
      outrosCount: json['othersCount'] ?? 0,
      totalCount: json['totalCount'] ?? 0,
      conteudo: json['content'] ?? '',
      lida: json['read'] ?? false,
      criadoEm: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
      atorNome: ator?['name'],
      atorUsername: ator?['username'],
      atorAvatarUrl: ator?['avatarUrl'],
      postImagemUrl: post?['imageUrl'],
      postLegenda: post?['caption'],
      postApagado: post?['isDeleted'] ?? false,
    );
  }
}
