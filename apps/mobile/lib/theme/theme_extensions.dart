import 'package:flutter/material.dart';
import 'package:mobile/theme/app_colors.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_typography.dart';

extension AppColorsX on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;

  /// Atalho para o gradiente da marca. Equivale a `context.colors.gradient`.
  /// Use direto em `BoxDecoration.gradient` (fundos, cards, botões).
  LinearGradient get gradient => colors.gradient;
}

extension AppTypographyX on BuildContext {
  /// Tokens de tipografia do Vibester (Outfit + DM Mono). Equivale a
  /// `context.colors`, mas para estilo de texto — ver `app_typography.dart`.
  AppTypography get typography => AppTypography.instance;
}

extension AppMotionX on BuildContext {
  /// Se o sistema pediu redução de movimento (Acessibilidade). Ver
  /// `app_motion.dart` para os tokens estáticos (`AppMotion.fast` etc.).
  bool get reduceMotion => AppMotion.reduceMotion(this);

  /// [duration], ou [Duration.zero] se `reduceMotion` estiver ativo.
  Duration adaptiveMotion(Duration duration) =>
      AppMotion.adaptive(this, duration);
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
