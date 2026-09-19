import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/navigation/navbar_tokens.dart';

/// Material da navbar: vidro fosco, contorno mínimo, sombra ampla e um brilho
/// difuso por trás.
///
/// A ordem das camadas é o que faz parecer vidro e não plástico
/// semitransparente:
///
/// ```text
/// brilho ambiente (fora da forma, difuso)
///   └─ sombra (ShapeDecoration)
///        └─ recorte na pill
///             ├─ desfoque do que está atrás
///             ├─ superfície semitransparente
///             ├─ luz na aresta de cima
///             └─ grão
///        └─ contorno (foregroundDecoration, por cima do conteúdo)
/// ```
///
/// Há **um** `BackdropFilter` no app inteiro, aqui. A navbar fica sobre listas
/// que rolam, e cada frame de scroll repinta o filtro: empilhar dois seria
/// pagar a conta duas vezes por frame.
class NavbarBackground extends StatelessWidget {
  final Widget child;

  /// Forma da barra. Uma pill simples: com o botão central dentro dela, um
  /// recorte no topo seria um vale sem nada apoiado nele.
  final OutlinedBorder shape;

  /// Intensidade do brilho ambiente, de 0 a 1. Animado na entrada.
  final double glow;

  const NavbarBackground({
    super.key,
    required this.child,
    this.shape = const StadiumBorder(),
    this.glow = 1,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Stack(
      clipBehavior: Clip.none,
      children: [
        // Iluminação difusa por trás da barra — gradiente radial, não blur:
        // um desfoque a mais aqui custaria outra passada de GPU por frame
        // para um efeito que o gradiente entrega igual.
        if (glow > 0)
          Positioned(
            left: -30,
            right: -30,
            top: -18,
            bottom: -26,
            child: IgnorePointer(
              child: Opacity(
                opacity: glow,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    gradient: RadialGradient(
                      center: Alignment.bottomCenter,
                      radius: 0.9,
                      colors: [
                        colors.ambar.withValues(
                          alpha: NavbarTokens.ambientGlowOpacity,
                        ),
                        colors.ambar.withValues(alpha: 0),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),

        Container(
          height: NavbarTokens.height,
          decoration: ShapeDecoration(
            shape: shape,
            shadows: NavbarTokens.shadows(colors.scrim),
          ),
          // O contorno vai por cima do conteúdo para não ser coberto pelo
          // vidro nem pelo grão.
          foregroundDecoration: ShapeDecoration(
            shape: shape.copyWith(
              side: BorderSide(
                color: colors.grey.withValues(alpha: 0.16),
                width: NavbarTokens.borderWidth,
              ),
            ),
          ),
          child: ClipPath(
            clipper: ShapeBorderClipper(shape: shape),
            child: Stack(
              fit: StackFit.expand,
              children: [
                BackdropFilter(
                  filter: ui.ImageFilter.blur(
                    sigmaX: NavbarTokens.blurSigma,
                    sigmaY: NavbarTokens.blurSigma,
                  ),
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      // Levemente mais claro em cima: simula a luz batendo na
                      // aresta superior do vidro.
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [
                          colors.surfaceRaised.withValues(
                            alpha: NavbarTokens.surfaceOpacity + 0.06,
                          ),
                          colors.surfaceRaised.withValues(
                            alpha: NavbarTokens.surfaceOpacity,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),

                // Grão da identidade: quase invisível, só tira o aspecto de
                // vidro genérico.
                const IgnorePointer(
                  child: Grain(
                    opacity: NavbarTokens.grainOpacity,
                    density: 0.45,
                  ),
                ),

                child,
              ],
            ),
          ),
        ),
      ],
    );
  }
}
