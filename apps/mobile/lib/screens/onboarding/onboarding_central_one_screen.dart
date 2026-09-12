import 'package:flutter/material.dart';
import 'package:mobile/models/user/interest_model.dart';
import 'package:mobile/service/user/interests_storage.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_chip.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/onboarding/onboarding_footer.dart';

/// ONBOARDING 2 — personalização.
///
/// Era a segunda tela institucional, com outro retângulo tracejado de
/// placeholder. Virou o único passo do onboarding que **faz** alguma coisa:
/// o usuário escolhe as vibes dele e a escolha é guardada
/// ([InterestsStorage]), passando a valer no filtro da Home.
///
/// A escolha é opcional de propósito — nada de barrar a entrada no produto
/// atrás de um formulário de preferências (§54: não coletar informação sem
/// necessidade). Quem pular vê tudo, que é um padrão perfeitamente bom.
class OnboardingCentralOneScreen extends StatefulWidget {
  final VoidCallback onNext;
  final VoidCallback onBack;
  final VoidCallback onSkip;

  const OnboardingCentralOneScreen({
    super.key,
    required this.onNext,
    required this.onBack,
    required this.onSkip,
  });

  @override
  State<OnboardingCentralOneScreen> createState() =>
      _OnboardingCentralOneScreenState();
}

class _OnboardingCentralOneScreenState
    extends State<OnboardingCentralOneScreen> {
  final List<Interest> _interests = defaultInterests;

  int get _selectedCount => _interests.where((i) => i.selected).length;

  Future<void> _continuar() async {
    await InterestsStorage.save(_interests);
    widget.onNext();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          const Positioned.fill(child: Grain(opacity: 0.04, density: 0.4)),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.screen,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: AppSpacing.xxl),
                  Text(
                    'QUAL É A',
                    style: type.displayHuge.copyWith(color: colors.textPrimary),
                  ),
                  Text(
                    'SUA VIBE?',
                    style: type.displayHuge.copyWith(color: colors.ambar),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Escolhe o que você curte pra gente começar por aí. Dá '
                    'pra mudar quando quiser.',
                    style: type.bodyLarge.copyWith(color: colors.textSecondary),
                  ),

                  const SizedBox(height: AppSpacing.xl),
                  Expanded(
                    child: SingleChildScrollView(
                      child: Wrap(
                        spacing: AppSpacing.sm,
                        runSpacing: AppSpacing.xs,
                        children: [
                          for (final interest in _interests)
                            VibesterChip(
                              label: interest.label,
                              emoji: interest.emoji,
                              selected: interest.selected,
                              onTap: () => setState(
                                () => interest.selected = !interest.selected,
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),

                  if (_selectedCount > 0)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: Text(
                        _selectedCount == 1
                            ? '1 VIBE ESCOLHIDA'
                            : '$_selectedCount VIBES ESCOLHIDAS',
                        style: type.monoMicro.copyWith(color: colors.ambar),
                      ),
                    ),

                  OnboardingFooterHost(
                    onNext: _continuar,
                    onBack: widget.onBack,
                    hasSelection: _selectedCount > 0,
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

/// Pequeno invólucro para escolher o rótulo do botão conforme haja seleção —
/// "Continuar" quando o usuário escolheu algo, "Depois eu escolho" quando não.
class OnboardingFooterHost extends StatelessWidget {
  final VoidCallback onNext;
  final VoidCallback onBack;
  final bool hasSelection;

  const OnboardingFooterHost({
    super.key,
    required this.onNext,
    required this.onBack,
    required this.hasSelection,
  });

  @override
  Widget build(BuildContext context) {
    return OnboardingFooter(
      step: 1,
      total: 3,
      onBack: onBack,
      onNext: onNext,
      nextLabel: hasSelection ? 'Continuar' : 'Depois eu vejo',
    );
  }
}
