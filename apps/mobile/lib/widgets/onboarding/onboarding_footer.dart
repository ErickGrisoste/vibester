import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Rodapé comum às três telas do onboarding: progresso à esquerda, ação
/// principal à direita, "pular"/"voltar" como texto discreto.
///
/// Existe para as três telas não repetirem — e divergirem — o mesmo bloco de
/// botões, que era o caso antes: cada uma montava o próprio `Row` de rodapé,
/// com paddings e tamanhos ligeiramente diferentes, e cada uma tinha a própria
/// cópia privada do widget de bolinhas de página.
class OnboardingFooter extends StatelessWidget {
  final int step;
  final int total;
  final VoidCallback onNext;
  final String nextLabel;

  /// Nulo esconde o "pular" (na última tela não há o que pular).
  final VoidCallback? onSkip;

  /// Nulo esconde o "voltar" (na primeira tela não há para onde voltar).
  final VoidCallback? onBack;

  const OnboardingFooter({
    super.key,
    required this.step,
    required this.total,
    required this.onNext,
    this.nextLabel = 'Próximo',
    this.onSkip,
    this.onBack,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Progresso como traços que crescem, não bolinhas: combina com o
          // traço de marcador usado no resto do app.
          Row(
            children: [
              for (var i = 0; i < total; i++)
                AnimatedContainer(
                  duration: context.adaptiveMotion(AppMotion.ui),
                  curve: AppMotion.standard,
                  margin: const EdgeInsets.only(right: AppSpacing.sm),
                  height: 3,
                  width: i == step ? 28 : 12,
                  decoration: BoxDecoration(
                    color: i == step ? colors.ambar : colors.hairline,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              const Spacer(),
              Text(
                '${step + 1} / $total',
                style: context.typography.monoMicro.copyWith(
                  color: colors.textDisabled,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xl),
          Row(
            children: [
              if (onBack != null)
                _TextAction(label: 'VOLTAR', onTap: onBack!)
              else if (onSkip != null)
                _TextAction(label: 'PULAR', onTap: onSkip!),
              const Spacer(),
              SizedBox(
                width: 150,
                child: VibesterButton(label: nextLabel, onPressed: onNext),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TextAction extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _TextAction({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return VibesterPressable(
      onTap: onTap,
      borderRadius: AppRadius.pillAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.lg,
        ),
        child: Text(
          label,
          style: context.typography.monoMicro.copyWith(
            color: context.colors.textMuted,
          ),
        ),
      ),
    );
  }
}
