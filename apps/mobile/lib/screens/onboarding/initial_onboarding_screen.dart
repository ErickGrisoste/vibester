import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/scribble_mark.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/motion/word_reveal_text.dart';
import 'package:mobile/widgets/onboarding/onboarding_footer.dart';

/// ONBOARDING 1 — o conceito.
///
/// Antes esta era uma tela institucional com um retângulo tracejado escrito
/// "mapa com os locais" no meio: um placeholder de imagem que nunca chegou.
/// Em vez de esperar a arte, a tela agora **é** a arte — a manchete do produto
/// em tela cheia, do jeito que a Home vai receber o usuário logo depois. O
/// onboarding apresenta o Vibester mostrando o Vibester.
class InitialOnboardingScreen extends StatelessWidget {
  /// Avança para a tela 2.
  final VoidCallback onNext;

  /// Pula direto para a última tela.
  final VoidCallback onSkip;

  const InitialOnboardingScreen({
    super.key,
    required this.onNext,
    required this.onSkip,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          Positioned(
            left: -110,
            top: 40,
            child: SprayGlow(color: colors.ambar, size: 340, intensity: 0.2),
          ),
          const Positioned.fill(child: Grain(opacity: 0.05, density: 0.5)),

          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.screen,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Spacer(),

                  Text(
                    'TUDO QUE',
                    style: type.displayHuge.copyWith(color: colors.textPrimary),
                  ),
                  Text(
                    'ROLA NA',
                    style: type.displayHuge.copyWith(color: colors.textPrimary),
                  ),
                  Stack(
                    clipBehavior: Clip.none,
                    children: [
                      WordRevealText(
                        text: 'CIDADE',
                        style: type.displayHuge.copyWith(color: colors.ambar),
                      ),
                      Positioned(
                        left: -6,
                        bottom: -4,
                        child: ScribbleMark(
                          shape: ScribbleShape.underline,
                          color: colors.brasa,
                          size: const Size(190, 16),
                          strokeWidth: 3,
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    'Bares, baladas, restaurantes e eventos — em um lugar só, '
                    'com o movimento de cada lugar em tempo real.',
                    style: type.bodyLarge.copyWith(color: colors.textSecondary),
                  ),

                  const Spacer(),

                  OnboardingFooter(
                    step: 0,
                    total: 3,
                    onSkip: onSkip,
                    onNext: onNext,
                    nextLabel: 'Bora',
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
