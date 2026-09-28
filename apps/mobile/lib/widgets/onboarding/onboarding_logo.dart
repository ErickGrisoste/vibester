import 'package:flutter/material.dart';

/// Logotipo do Vibester no onboarding, no par certo para o tema.
///
/// Mesmo par da tela inicial e do feed: `tipografia.png` tem o "STER" branco,
/// para o fundo escuro; `tipografia_preto.png`, o "STER" preto, para o claro.
/// Os arquivos são grandes (4072px, ~1MB) para servirem de capa, então aqui
/// a imagem é decodificada numa largura só, [maxWidth] — a mesma para as
/// páginas 1 e 4, que assim dividem uma decodificação no cache em vez de
/// fazer duas.
class OnboardingLogo extends StatelessWidget {
  /// Largura exibida; limitada a [maxWidth].
  final double width;

  const OnboardingLogo({super.key, required this.width});

  static const maxWidth = 260.0;

  static const _dark = 'assets/img/logo/tipografia.png';
  static const _light = 'assets/img/logo/tipografia_preto.png';

  @override
  Widget build(BuildContext context) {
    final light = Theme.of(context).brightness == Brightness.light;
    final pixelRatio = MediaQuery.devicePixelRatioOf(context);

    return Image.asset(
      light ? _light : _dark,
      width: width.clamp(0.0, maxWidth),
      cacheWidth: (maxWidth * pixelRatio).round(),
      fit: BoxFit.contain,
      semanticLabel: 'Vibester',
    );
  }
}
