import 'dart:io';

/// Tipo de mídia, com o valor que o post-service espera em `files[].type` e
/// `media[].type` (`IMAGE`/`VIDEO`).
enum MediaKind {
  image('IMAGE'),
  video('VIDEO');

  const MediaKind(this.apiValue);

  final String apiValue;

  static MediaKind fromApi(Object? value) =>
      value == video.apiValue ? video : image;
}

/// Uma mídia local já pronta para subir: processada (redimensionada,
/// recomprimida e, quando o fluxo pede, recortada) e com o content-type real.
///
/// O content-type viaja junto porque a URL pré-assinada do R2 é assinada com
/// ele — o `PUT` precisa mandar exatamente o mesmo, ou o R2 responde 403. Com
/// ele explícito aqui, ninguém precisa adivinhar o tipo pela extensão.
class MediaItem {
  final File file;
  final MediaKind kind;
  final String contentType;

  /// Capa do vídeo, já processada como JPEG. Sobe junto e vira o
  /// `thumbnailUrl` do item — é o que o feed mostra antes do play.
  final MediaItem? thumbnail;

  /// Duração do vídeo, para a miniatura no composer.
  final Duration? duration;

  const MediaItem({
    required this.file,
    required this.kind,
    required this.contentType,
    this.thumbnail,
    this.duration,
  });

  const MediaItem.jpeg(this.file)
    : kind = MediaKind.image,
      contentType = 'image/jpeg',
      thumbnail = null,
      duration = null;

  const MediaItem.mp4(this.file, {required MediaItem this.thumbnail, this.duration})
    : kind = MediaKind.video,
      contentType = 'video/mp4';

  String get path => file.path;
  bool get isVideo => kind == MediaKind.video;

  /// O arquivo que representa a mídia em miniatura: a própria foto, ou a
  /// capa do vídeo.
  String get coverPath => thumbnail?.path ?? path;
}
