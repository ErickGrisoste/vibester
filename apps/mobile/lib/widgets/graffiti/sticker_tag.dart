import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// **Sticker → destaque.**
///
/// Etiqueta colada por cima do conteúdo, sempre levemente torta e com sombra
/// dura (deslocada, sem blur — papel colado projeta aresta, não névoa). É o
/// elemento mais chamativo da linguagem urbana do app, então vale a regra:
/// **no máximo um sticker por composição**. Dois stickers na mesma imagem
/// deixam de destacar coisa alguma.
///
/// Para metadado corrido (data, distância, categoria) use `VibesterTag`, que
/// é reto e silencioso — sticker é para o que precisa gritar ("HOJE",
/// "ÚLTIMOS INGRESSOS", "DESTAQUE").
class StickerTag extends StatelessWidget {
  final String label;

  /// Cor do papel. Padrão `ambar`.
  final Color? color;

  /// Cor do texto sobre o papel.
  final Color? foreground;

  /// Inclinação em graus. Pequena de propósito: passou de ~5° vira adesivo
  /// de brinde, não direção de arte.
  final double tiltDegrees;

  /// Ícone opcional antes do texto (use ícones de 12–14px).
  final IconData? icon;

  /// Anima a entrada com escala + overshoot. Deixe `false` em listas longas.
  final bool animateIn;

  const StickerTag({
    super.key,
    required this.label,
    this.color,
    this.foreground,
    this.tiltDegrees = -3,
    this.icon,
    this.animateIn = true,
  }) : _live = false;

  /// Marca a variante urgente — resolve a cor no `build`, onde o tema existe.
  final bool _live;

  /// Variante "acontecendo agora": papel `brasa` (a cor quente/urgente da
  /// paleta) com um ponto antes do texto. Use só quando os dados sustentarem
  /// a afirmação — FOMO inventado é dado falso.
  const StickerTag.live({
    super.key,
    this.label = 'ROLANDO AGORA',
    this.animateIn = true,
  }) : color = null,
       foreground = null,
       tiltDegrees = -2.5,
       icon = Icons.circle,
       _live = true;

  @override
  Widget build(BuildContext context) {
    final paper = color ?? (_live ? context.colors.live : context.colors.ambar);
    final ink = foreground ?? context.colors.onFill(paper);

    final sticker = Transform.rotate(
      angle: tiltDegrees * 3.1415926535 / 180,
      child: Container(
        padding: EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs + 1,
        ),
        decoration: BoxDecoration(
          color: paper,
          borderRadius: AppRadius.stickerAll,
          boxShadow: [
            // Sombra dura: papel colado sobre superfície.
            BoxShadow(
              color: context.colors.scrim.withValues(alpha: 0.45),
              offset: const Offset(2, 2),
            ),
          ],
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (icon != null) ...[
              Icon(icon, size: 8, color: ink),
              const SizedBox(width: AppSpacing.xs + 1),
            ],
            Text(
              label.toUpperCase(),
              style: context.typography.monoTag.copyWith(color: ink),
            ),
          ],
        ),
      ),
    );

    if (!animateIn || context.reduceMotion) return sticker;

    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0.0, end: 1.0),
      duration: AppMotion.ui,
      curve: AppMotion.emphasis,
      builder: (_, t, child) => Transform.scale(scale: t, child: child),
      child: sticker,
    );
  }
}
