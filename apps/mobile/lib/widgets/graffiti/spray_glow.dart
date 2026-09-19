import 'package:flutter/material.dart';

/// **Spray → profundidade.**
///
/// Mancha de tinta difusa atrás de um elemento — usada para separar a
/// manchete do fundo e dar a sensação de que o conteúdo foi pintado sobre a
/// tela, não colocado nela.
///
/// Implementada como `RadialGradient` num `DecoratedBox`, não como
/// `BackdropFilter`/`ImageFiltered`: blur real custa uma passada de GPU por
/// frame e é a primeira coisa a derrubar o FPS em lista rolável. O gradiente
/// radial dá o mesmo efeito visual por praticamente zero.
///
/// Usa apenas cores da paleta ([AppColors.ambar]/[AppColors.brasa] por
/// padrão, via o parâmetro `color`), sempre em alpha baixo.
class SprayGlow extends StatelessWidget {
  /// Cor da mancha — passe um token da paleta (`context.colors.ambar` etc.).
  final Color color;

  /// Diâmetro da mancha.
  final double size;

  /// Intensidade no centro. Acima de ~0.35 vira "gradiente de fundo genérico"
  /// em vez de textura.
  final double intensity;

  /// Achatamento horizontal — 1 = círculo, >1 = mancha alongada (mais
  /// parecida com spray passado de lado).
  final double stretch;

  const SprayGlow({
    super.key,
    required this.color,
    this.size = 260,
    this.intensity = 0.22,
    this.stretch = 1.4,
  });

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: SizedBox(
        width: size * stretch,
        height: size,
        child: DecoratedBox(
          decoration: BoxDecoration(
            gradient: RadialGradient(
              colors: [
                color.withValues(alpha: intensity),
                color.withValues(alpha: intensity * 0.45),
                color.withValues(alpha: 0),
              ],
              stops: const [0.0, 0.45, 1.0],
            ),
          ),
        ),
      ),
    );
  }
}
