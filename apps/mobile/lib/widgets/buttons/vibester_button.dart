import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:mobile/widgets/motion/vibester_shake.dart';

/// Peso visual do botão. A regra do produto é uma ação principal por tela
/// ([VibesterButtonVariant.primary]) e o resto abaixo dela.
enum VibesterButtonVariant {
  /// Ação principal — preenchido em `ambar`.
  primary,

  /// Ação urgente/confirmação de presença — preenchido em `brasa`.
  accent,

  /// Ação secundária — contorno, fundo transparente.
  outline,

  /// Ação terciária — só texto, sem caixa.
  ghost,
}

/// Estado de uma ação assíncrona. Todo botão do app entende os quatro, então
/// nenhuma tela precisa inventar o próprio spinner ou o próprio "salvo!".
enum VibesterButtonState { idle, loading, success, error }

/// Botão do Vibester.
///
/// Um único componente para todas as ações, com quatro pesos e quatro
/// estados. Substitui a família anterior (`PrimaryButton` com largura fixa de
/// 350px e três sombras empilhadas de brilho) — largura fixa quebra em tela
/// estreita, e brilho triplo é a definição de premium que o briefing pede
/// para evitar: o peso vem da cor sólida, do tamanho do alvo e da resposta ao
/// toque, não do halo.
class VibesterButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final VibesterButtonVariant variant;
  final VibesterButtonState state;
  final IconData? icon;

  /// Ocupa toda a largura disponível. Padrão para CTA de formulário e de
  /// rodapé; deixe `false` para ação inline.
  final bool expand;

  /// Altura reduzida (44px em vez de 56px) — ação secundária dentro de um
  /// bloco, não CTA de tela.
  final bool compact;

  /// Rótulos alternativos por estado. `loading` sempre mostra o indicador,
  /// então só `success`/`error` usam texto próprio.
  final String? successLabel;
  final String? errorLabel;

  const VibesterButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.variant = VibesterButtonVariant.primary,
    this.state = VibesterButtonState.idle,
    this.icon,
    this.expand = true,
    this.compact = false,
    this.successLabel,
    this.errorLabel,
  });

  bool get _isBusy => state == VibesterButtonState.loading;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final disabled = onPressed == null || _isBusy;

    final (Color background, Color foreground, Color? border) = switch ((
      variant,
      state,
    )) {
      // O texto sobre preenchimento sai de `onFill`, que escolhe tinta ou
      // branco pelo contraste real da cor de fundo (ver AppColors.onFill).
      (_, VibesterButtonState.error) => (
        colors.error,
        colors.onFill(colors.error),
        null,
      ),
      (VibesterButtonVariant.primary, _) => (
        colors.ambar,
        colors.onAmbar,
        null,
      ),
      (VibesterButtonVariant.accent, _) => (colors.brasa, colors.onBrasa, null),
      (VibesterButtonVariant.outline, VibesterButtonState.success) => (
        colors.ambar.withValues(alpha: 0.14),
        colors.ambar,
        colors.ambar,
      ),
      (VibesterButtonVariant.outline, _) => (
        Colors.transparent,
        colors.textPrimary,
        colors.outline,
      ),
      (VibesterButtonVariant.ghost, _) => (
        Colors.transparent,
        colors.textSecondary,
        null,
      ),
    };

    final text = switch (state) {
      VibesterButtonState.success => successLabel ?? label,
      VibesterButtonState.error => errorLabel ?? label,
      _ => label,
    };

    final content = AnimatedSwitcher(
      duration: context.adaptiveMotion(AppMotion.micro),
      child: _isBusy
          ? SizedBox(
              key: const ValueKey('loading'),
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                strokeWidth: 2.2,
                color: foreground,
              ),
            )
          : Row(
              key: ValueKey('$text-${state.name}'),
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                if (state == VibesterButtonState.success) ...[
                  Icon(Icons.check_rounded, size: 18, color: foreground),
                  const SizedBox(width: AppSpacing.sm),
                ] else if (icon != null) ...[
                  Icon(icon, size: 18, color: foreground),
                  const SizedBox(width: AppSpacing.sm),
                ],
                Flexible(
                  child: Text(
                    text,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.typography.titleMedium.copyWith(
                      color: foreground,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
    );

    return Semantics(
      button: true,
      enabled: !disabled,
      label: text,
      child: VibesterShake(
        trigger: state,
        child: Opacity(
          opacity: onPressed == null ? 0.45 : 1,
          child: VibesterPressable(
            onTap: disabled ? null : onPressed,
            borderRadius: AppRadius.pillAll,
            child: AnimatedContainer(
              duration: context.adaptiveMotion(AppMotion.ui),
              curve: AppMotion.standard,
              width: expand ? double.infinity : null,
              height: compact ? 44 : 56,
              padding: EdgeInsets.symmetric(
                horizontal: expand ? AppSpacing.lg : AppSpacing.xl,
              ),
              decoration: BoxDecoration(
                color: background,
                borderRadius: AppRadius.pillAll,
                border: border == null
                    ? null
                    : Border.all(color: border, width: AppStroke.regular),
              ),
              child: Center(child: content),
            ),
          ),
        ),
      ),
    );
  }
}
