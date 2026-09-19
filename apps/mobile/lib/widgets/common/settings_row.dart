import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Peças das telas de ajuste: rótulo de grupo e linha de item.
///
/// Ficam num arquivo próprio para que toda tela de ajuste desenhe grupos e
/// linhas do mesmo jeito, sem paddings e tamanhos de fonte divergindo.

class SettingsGroupLabel extends StatelessWidget {
  final String label;

  const SettingsGroupLabel(this.label, {super.key});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.xxl,
        AppSpacing.screen,
        AppSpacing.sm,
      ),
      child: Text(
        label,
        style: context.typography.monoEyebrow.copyWith(
          color: context.colors.ambar,
        ),
      ),
    );
  }
}

/// Linha de ajuste. Sem card em volta: o fio de 1px embaixo já separa, e a
/// altura acompanha o texto — inclusive quando a descrição quebra em duas
/// linhas.
class SettingsRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final String? description;
  final VoidCallback? onTap;
  final Widget? trailing;

  /// Destaca em `ambar` (usado no item de assinatura).
  final bool accent;

  final bool loading;

  const SettingsRow({
    super.key,
    required this.icon,
    required this.label,
    this.description,
    this.onTap,
    this.trailing,
    this.accent = false,
    this.loading = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final disabled = onTap == null && trailing == null;

    final content = Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.screen,
        vertical: AppSpacing.lg,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.hairline)),
      ),
      child: Row(
        children: [
          Icon(icon, size: 19, color: accent ? colors.ambar : colors.textMuted),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: type.titleMedium.copyWith(
                    color: accent ? colors.ambar : colors.textPrimary,
                  ),
                ),
                if (description != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    description!,
                    style: type.bodySmall.copyWith(color: colors.textMuted),
                  ),
                ],
              ],
            ),
          ),
          if (loading)
            SizedBox(
              width: 18,
              height: 18,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: colors.ambar,
              ),
            )
          else if (trailing != null)
            trailing!
          else
            Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: colors.textDisabled,
            ),
        ],
      ),
    );

    if (disabled) {
      return Opacity(opacity: 0.45, child: content);
    }

    if (trailing != null && onTap == null) return content;

    return VibesterPressable(onTap: onTap, child: content);
  }
}
