import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Cabeçalho de tela secundária.
///
/// Substitui o `AppBar` nas telas internas. Um `AppBar` centraliza um título
/// pequeno numa barra de altura fixa e desperdiça a faixa mais nobre da tela;
/// aqui o título é editorial (grande, alinhado à esquerda, com a linha de
/// sistema em DM Mono acima), e o voltar é um alvo quadrado de 44px no canto,
/// alinhado com a margem do conteúdo.
class ScreenHeader extends StatelessWidget {
  final String title;

  /// Linha de contexto acima do título (DM Mono, caixa alta).
  final String? eyebrow;

  /// Exibe o botão de voltar. Desligue em tela raiz de destino.
  final bool showBack;

  /// Ação no canto direito (ícone).
  final Widget? action;

  /// Espaço abaixo do bloco.
  final double bottomSpacing;

  const ScreenHeader({
    super.key,
    required this.title,
    this.eyebrow,
    this.showBack = true,
    this.action,
    this.bottomSpacing = AppSpacing.lg,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Padding(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.sm,
        AppSpacing.screen,
        bottomSpacing,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showBack || action != null)
            Row(
              children: [
                if (showBack) const _BackButton(),
                const Spacer(),
                ?action,
              ],
            ),
          const SizedBox(height: AppSpacing.md),
          if (eyebrow != null) ...[
            Text(
              eyebrow!.toUpperCase(),
              style: type.monoEyebrow.copyWith(color: colors.ambar),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          Text(
            title,
            style: type.displayLarge.copyWith(color: colors.textPrimary),
          ),
        ],
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  const _BackButton();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      label: 'Voltar',
      child: VibesterPressable(
        onTap: () => Navigator.maybePop(context),
        borderRadius: AppRadius.smAll,
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.smAll,
            border: Border.all(color: colors.hairline),
          ),
          child: Icon(
            Icons.arrow_back_rounded,
            size: 20,
            color: colors.textPrimary,
          ),
        ),
      ),
    );
  }
}
