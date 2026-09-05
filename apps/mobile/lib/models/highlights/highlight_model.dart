class HighlightModel {
  final String postId;
  final String userId;
  final String? estabelecimentoId;
  final List<String> imagensUrls;
  final String legenda;
  final int totalCurtidas;
  final int totalComentarios;
  final bool curtidoPeloUsuario;
  final bool foiDeletado;
  final String criadoEm;
  final String atualizadoEm;

  HighlightModel({
    required this.postId,
    required this.userId,
    this.estabelecimentoId,
    required this.imagensUrls,
    required this.legenda,
    required this.totalCurtidas,
    required this.totalComentarios,
    this.curtidoPeloUsuario = false,
    required this.foiDeletado,
    required this.criadoEm,
    required this.atualizadoEm,
  });

  // Json pra dart, é pra quando os dados virem da API
  // O estabelecimentoId pode vir null de verdade
  factory HighlightModel.fromJson(Map<String, dynamic> json) {
    return HighlightModel(
      postId: json['postId'] ?? '',
      userId: json['userId'] ?? '',
      estabelecimentoId: json['establishmentId'],
      imagensUrls: json['imageUrls'] != null
          ? List<String>.from(json['imageUrls'])
          : <String>[],
      legenda: json['caption'] ?? '',
      totalCurtidas: json['totalLikes'] ?? 0,
      totalComentarios: json['totalComments'] ?? 0,
      curtidoPeloUsuario: json['isLiked'] ?? false,
      foiDeletado: json['isDeleted'] ?? false,
      criadoEm: json['createdAt'] ?? '',
      atualizadoEm: json['updatedAt'] ?? '',
    );
  }

  // A primeira imagem da lista, usada pelo HighlightsCard
  // Fica vazia se a lista de imagens estiver vazia, pra não estourar erro
  String get imagemEmDestaque =>
      imagensUrls.isNotEmpty ? imagensUrls.first : '';

  HighlightModel copyWith({int? totalCurtidas, bool? curtidoPeloUsuario}) {
    return HighlightModel(
      postId: postId,
      userId: userId,
      estabelecimentoId: estabelecimentoId,
      imagensUrls: imagensUrls,
      legenda: legenda,
      totalCurtidas: totalCurtidas ?? this.totalCurtidas,
      totalComentarios: totalComentarios,
      curtidoPeloUsuario: curtidoPeloUsuario ?? this.curtidoPeloUsuario,
      foiDeletado: foiDeletado,
      criadoEm: criadoEm,
      atualizadoEm: atualizadoEm,
    );
  }
}
