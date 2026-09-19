import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/graffiti/brush_rule.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Abertura de seção editorial.
///
/// A estrutura fixa — eyebrow em DM Mono, título em Outfit pesado, ação
/// opcional à direita — é o que dá ritmo à Home: o olho aprende que a linha
/// mono pequena significa "começou um assunto novo", e a manchete grande
/// significa "é este o assunto".
///
/// O número do eyebrow não é decorativo: numerar as seções ("01 / …",
/// "02 / …") transforma a Home numa sequência com começo e fim, e não numa
/// pilha de carrosséis indistintos.
class SectionHeader extends StatelessWidget {
  /// Título grande (Outfit). Curto — é manchete, não frase.
  final String title;

  /// Linha de sistema acima do título (DM Mono). Ex.: 'PERTO DE VOCÊ'.
  final String? eyebrow;

  /// Índice da seção, prefixado ao eyebrow como '03 /'.
  final int? index;

  /// Uma linha de apoio abaixo do título, quando o título sozinho não
  /// explica o critério da seção.
  final String? subtitle;

  /// Ação à direita. Sem label: usa 'VER TUDO'.
  final VoidCallback? onActionTap;
  final String actionLabel;

  /// Traço de pincel abaixo do bloco. Reservado para as aberturas mais
  /// fortes — se toda seção tiver, nenhuma tem.
  final bool brush;

  const SectionHeader({
    super.key,
    required this.title,
    this.eyebrow,
    this.index,
    this.subtitle,
    this.onActionTap,
    this.actionLabel = 'VER TUDO',
    this.brush = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    final eyebrowText = [
      if (index != null) index!.toString().padLeft(2, '0'),
      if (eyebrow != null) eyebrow!.toUpperCase(),
    ].join('  /  ');

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.xl,
        AppSpacing.screen,
        AppSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (eyebrowText.isNotEmpty) ...[
            Text(
              eyebrowText,
              style: type.monoEyebrow.copyWith(color: colors.ambar),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: type.displayMedium.copyWith(color: colors.textPrimary),
                ),
              ),
              if (onActionTap != null) ...[
                const SizedBox(width: AppSpacing.md),
                _SectionAction(label: actionLabel, onTap: onActionTap!),
              ],
            ],
          ),
          if (subtitle != null) ...[
            const SizedBox(height: AppSpacing.xs + 2),
            Text(
              subtitle!,
              style: type.bodyMedium.copyWith(color: colors.textMuted),
            ),
          ],
          if (brush) ...[
            const SizedBox(height: AppSpacing.sm),
            SizedBox(
              width: 96,
              child: BrushRule(color: colors.brasa, thickness: 5, height: 12),
            ),
          ],
        ],
      ),
    );
  }
}

class _SectionAction extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _SectionAction({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return VibesterPressable(
      onTap: onTap,
      borderRadius: AppRadius.pillAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.sm,
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              label,
              style: context.typography.monoMicro.copyWith(
                color: context.colors.textSecondary,
              ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Icon(
              Icons.arrow_forward,
              size: 13,
              color: context.colors.textSecondary,
            ),
          ],
        ),
      ),
    );
  }
}
