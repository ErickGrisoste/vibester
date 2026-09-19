/// Como um vídeo sai do aparelho, por destino — o par de `ImageSpec`.
///
/// A resolução de saída é fixa no processador (720p): o post-service pede
/// "até 1080p com bitrate controlado", e no iOS o preset de 1080p mantém o
/// bitrate perto do original — 720p é o que de fato reduz o peso do feed.
class VideoSpec {
  /// Duração máxima aceita. A câmera para de gravar sozinha nela e a galeria
  /// recusa vídeo mais longo (cortar só funciona sem áudio no iOS).
  final Duration maxDuration;

  const VideoSpec({required this.maxDuration});

  static const post = VideoSpec(maxDuration: Duration(seconds: 60));
}
