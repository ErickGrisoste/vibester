import 'package:flutter/material.dart';
import 'package:mobile/models/user/interest_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/auth_storage_service.dart';
import 'package:mobile/service/user/interests_storage.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/vibester_chip.dart';
import 'package:mobile/widgets/graffiti/grain.dart';

/// Seus interesses.
///
/// Mesma tela do fluxo de cadastro, agora com a escolha realmente sendo
/// guardada ([InterestsStorage]) — antes o toque só alternava um booleano na
/// lista em memória, que sumia ao fechar o app. Também deixou de ter um
/// `SizedBox(height: 300)` fixo empurrando o botão para baixo: a ação fica
/// ancorada no rodapé em qualquer tamanho de tela.
class UserInterestsScreen extends StatefulWidget {
  const UserInterestsScreen({super.key});

  @override
  State<UserInterestsScreen> createState() => _UserInterestsScreenState();
}

class _UserInterestsScreenState extends State<UserInterestsScreen> {
  final List<Interest> _interests = defaultInterests;

  Future<void> _continuar() async {
    await InterestsStorage.save(_interests);

    // Marca o onboarding como pendente antes de abri-lo, para que ele
    // reapareça se o app for fechado no meio.
    await AuthStorageService.marcarOnboardingPendente();
    if (!mounted) return;

    // Fim do fluxo de cadastro: remove register, email-confirm, profile-edit e
    // esta tela da pilha. O onboarding passa a ser a única rota; a home só vem
    // depois do "Começar".
    Navigator.pushNamedAndRemoveUntil(
      context,
      AppRoutes.onboarding,
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final selecionados = _interests.where((i) => i.selected).length;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          const Positioned.fill(child: Grain(opacity: 0.04, density: 0.4)),
          SafeArea(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const ScreenHeader(
                  title: 'O que você\ncurte?',
                  eyebrow: 'SUA VIBE',
                ),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.screen,
                    ),
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
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.screen),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        selecionados == 0
                            ? 'PODE ESCOLHER DEPOIS'
                            : '$selecionados SELECIONADAS',
                        style: context.typography.monoMicro.copyWith(
                          color: selecionados == 0
                              ? colors.textDisabled
                              : colors.ambar,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      VibesterButton(label: 'Continuar', onPressed: _continuar),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
