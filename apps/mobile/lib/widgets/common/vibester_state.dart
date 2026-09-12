import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/scribble_mark.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Estado vazio ou de erro do Vibester.
///
/// Um estado vazio é uma tela como outra qualquer: precisa dizer **o que
/// aconteceu**, **por quê** e **o que fazer agora**. A personalidade entra na
/// manchete curta em caixa alta (a voz de cartaz do produto), nunca no lugar
/// da informação — "NADA POR AQUI. AINDA." é a manchete; a linha de baixo
/// continua explicando o motivo em português claro.
class VibesterState extends StatelessWidget {
  /// Manchete curta, 1–3 palavras. Exibida em caixa alta.
  final String headline;

  /// O que aconteceu e o que o usuário pode fazer. Uma ou duas linhas.
  final String message;

  /// Ação principal. Em erro, quase sempre 'Tentar de novo'.
  final String? actionLabel;
  final VoidCallback? onAction;

  /// Ícone de sistema exibido acima da manchete.
  final IconData icon;

  /// Usa `brasa` no lugar de `ambar` e trata a manchete como falha.
  final bool isError;

  const VibesterState({
    super.key,
    required this.headline,
    required this.message,
    this.actionLabel,
    this.onAction,
    this.icon = Icons.explore_off_outlined,
    this.isError = false,
  });

  /// Falha de carregamento. Mantém a mensagem tratada vinda do service —
  /// nunca uma `DioException` crua.
  const VibesterState.error({
    super.key,
    this.headline = 'DEU RUIM',
    required this.message,
    this.actionLabel = 'Tentar de novo',
    this.onAction,
    this.icon = Icons.wifi_off_rounded,
  }) : isError = true;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final accent = isError ? colors.brasa : colors.ambar;

    return Center(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.xxl,
          vertical: AppSpacing.huge,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Bloco de "parede": superfície com grão e o ícone dentro. Dá
            // presença ao vazio sem precisar de ilustração.
            ClipRRect(
              borderRadius: AppRadius.smAll,
              child: SizedBox(
                width: 64,
                height: 64,
                child: ColoredBox(
                  color: colors.surface,
                  child: Grain(
                    opacity: 0.08,
                    child: Center(child: Icon(icon, size: 26, color: accent)),
                  ),
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.xl),
            Stack(
              clipBehavior: Clip.none,
              children: [
                Text(
                  headline.toUpperCase(),
                  style: context.typography.displayMedium.copyWith(
                    color: colors.textPrimary,
                  ),
                ),
                Positioned(
                  left: -6,
                  right: -10,
                  bottom: -6,
                  child: ScribbleMark(
                    shape: ScribbleShape.underline,
                    color: accent.withValues(alpha: 0.7),
                    size: const Size(140, 12),
                    strokeWidth: 2,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md + 2),
            Text(
              message,
              style: context.typography.bodyMedium.copyWith(
                color: colors.textMuted,
              ),
            ),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: AppSpacing.xl),
              VibesterPressable(
                onTap: onAction,
                borderRadius: AppRadius.pillAll,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.xl,
                    vertical: AppSpacing.md,
                  ),
                  decoration: BoxDecoration(
                    color: accent,
                    borderRadius: AppRadius.pillAll,
                  ),
                  child: Text(
                    actionLabel!,
                    style: context.typography.titleMedium.copyWith(
                      color: colors.onFill(accent),
                    ),
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
