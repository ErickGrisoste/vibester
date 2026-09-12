/// Como uma imagem sai do aparelho, por destino.
///
/// É o único lugar com resolução e qualidade de envio: o recorte do avatar e
/// a compressão do post leem daqui, em vez de cada fluxo carregar números
/// próprios. O backend não recomprime o que chega pela URL assinada — o
/// arquivo que sobe é o que todo mundo baixa no feed (ver
/// `post-service/docs/midias-no-post.md`, "Compressão antes do upload").
class ImageSpec {
  /// Maior dimensão, em pixels, da imagem enviada. Nunca amplia.
  final int maxDimension;

  /// Qualidade JPEG, de 0 a 100.
  final int quality;

  /// Recorte quadrado obrigatório antes do envio.
  final bool squareCrop;

  const ImageSpec({
    required this.maxDimension,
    required this.quality,
    this.squareCrop = false,
  });

  /// Foto de post. 1920px na maior dimensão é a referência do post-service;
  /// JPEG 85 fica visualmente igual ao original numa tela de celular e sai
  /// com uma fração do peso.
  static const post = ImageSpec(maxDimension: 1920, quality: 85);

  /// Foto de perfil. O maior uso é o retrato do perfil (~120pt a 3x ≈
  /// 360px); 512px cobre com folga sem pesar nas listas que mostram avatar.
  static const avatar = ImageSpec(
    maxDimension: 512,
    quality: 85,
    squareCrop: true,
  );
}
