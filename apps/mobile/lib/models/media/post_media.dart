import 'package:mobile/models/media/media_item.dart';

/// Um item de `media[]` de um post já publicado, como a API devolve.
///
/// `media` vem em camelCase em todas as rotas de leitura — inclusive no
/// feed-service, cujos outros campos são snake_case (ver
/// `post-service/docs/midias-no-post.md`, "Leitura").
class PostMedia {
  final String url;
  final MediaKind kind;

  /// Capa do vídeo. Opcional mesmo em vídeo: posts antigos ou de outros
  /// clientes podem não ter.
  final String? thumbnailUrl;

  const PostMedia({required this.url, required this.kind, this.thumbnailUrl});

  const PostMedia.image(this.url) : kind = MediaKind.image, thumbnailUrl = null;

  factory PostMedia.fromJson(Map<String, dynamic> json) {
    final thumbnail = json['thumbnailUrl'];
    return PostMedia(
      url: json['url'] as String? ?? '',
      kind: MediaKind.fromApi(json['type']),
      thumbnailUrl: thumbnail is String && thumbnail.isNotEmpty
          ? thumbnail
          : null,
    );
  }

  bool get isVideo => kind == MediaKind.video;

  /// O que mostrar parado: a foto, ou a capa do vídeo (vazio se não houver —
  /// quem desenha cai no placeholder).
  String get coverUrl => isVideo ? thumbnailUrl ?? '' : url;

  /// Lê `media`; na falta dele (post anterior à mudança, versão antiga da
  /// API), cai para a lista legada de imagens, todas como `IMAGE`.
  static List<PostMedia> listFromJson(
    Object? media, {
    Object? legacyImageUrls,
  }) {
    if (media is List && media.isNotEmpty) {
      return [
        for (final item in media)
          if (item is Map<String, dynamic>) PostMedia.fromJson(item),
      ].where((m) => m.url.isNotEmpty).toList();
    }
    if (legacyImageUrls is List) {
      return [
        for (final url in legacyImageUrls)
          if (url is String && url.isNotEmpty) PostMedia.image(url),
      ];
    }
    return const [];
  }
}
