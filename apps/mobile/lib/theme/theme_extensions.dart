import 'package:flutter/material.dart';
import 'package:mobile/theme/app_colors.dart';

extension AppColorsX on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;

  /// Atalho para o gradiente da marca. Equivale a `context.colors.gradient`.
  /// Use direto em `BoxDecoration.gradient` (fundos, cards, botões).
  LinearGradient get gradient => colors.gradient;
}

/// Aplica o gradiente da marca sobre texto e ícones.
///
/// Ao contrário de `BoxDecoration.gradient`, que pinta o fundo, aqui o
/// gradiente vira a *cor* do próprio conteúdo:
///
/// ```dart
/// GradientMask(child: Icon(Icons.favorite, size: 40))
/// GradientMask(child: Text('Vibester', style: TextStyle(fontSize: 26)))
/// ```
///
/// Usa `BlendMode.srcIn`, então a cor original do filho é descartada e não
/// precisa ser branca. Sem `gradient` explícito, pega `context.colors.gradient`.
class GradientMask extends StatelessWidget {
  final Widget child;
  final Gradient? gradient;

  const GradientMask({super.key, required this.child, this.gradient});

  @override
  Widget build(BuildContext context) {
    final effectiveGradient = gradient ?? context.colors.gradient;
    return ShaderMask(
      blendMode: BlendMode.srcIn,
      shaderCallback: (bounds) =>
          effectiveGradient.createShader(Offset.zero & bounds.size),
      child: child,
    );
  }
}