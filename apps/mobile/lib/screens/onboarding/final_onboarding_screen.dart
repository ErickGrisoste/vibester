import 'package:flutter/material.dart';
import 'package:mobile/providers/place/nearby_provider.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/onboarding/onboarding_footer.dart';
import 'package:provider/provider.dart';

/// ONBOARDING 3 — localização, no momento em que ela faz sentido.
///
/// A permissão de localização é pedida aqui, com o motivo explicado, e não no
/// primeiro frame do app nem no meio de uma tela de descoberta. Se o usuário
/// recusar, o produto continua inteiro: só a seção "perto de você" fica sem
/// dado, e ela mesma oferece ativar depois.
///
/// Pedir permissão nativa a partir de uma tela que explica o porquê é o que
/// separa "o app quer minha localização" de "o app vai me mostrar o que tem
/// perto" — e é a diferença entre conceder e negar para sempre.
class FinalOnboardingScreen extends StatefulWidget {
  final VoidCallback onBack;
  final VoidCallback onStart;

  const FinalOnboardingScreen({
    super.key,
    required this.onBack,
    required this.onStart,
  });

  @override
  State<FinalOnboardingScreen> createState() => _FinalOnboardingScreenState();
}

class _FinalOnboardingScreenState extends State<FinalOnboardingScreen> {
  bool _asking = false;

  Future<void> _permitirEComecar() async {
    setState(() => _asking = true);

    // O provider já trata permissão negada e GPS desligado como "sem
    // localização" — nada aqui bloqueia a entrada no app.
    await context.read<NearbyProvider>().load(force: true);

    if (!mounted) return;
    setState(() => _asking = false);
    widget.onStart();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          Positioned(
            right: -120,
            bottom: 80,
            child: SprayGlow(color: colors.brasa, size: 320, intensity: 0.18),
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

                  Icon(Icons.near_me_outlined, size: 34, color: colors.ambar),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    'O QUE TÁ',
                    style: type.displayHuge.copyWith(color: colors.textPrimary),
                  ),
                  Text(
                    'DO SEU LADO',
                    style: type.displayHuge.copyWith(color: colors.ambar),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'Com a sua localização a gente mostra o que está rolando '
                    'perto de você agora — e a distância até cada lugar. Sem '
                    'ela o app funciona igual, só sem essa parte.',
                    style: type.bodyLarge.copyWith(color: colors.textSecondary),
                  ),

                  const Spacer(),

                  OnboardingFooter(
                    step: 2,
                    total: 3,
                    onBack: widget.onBack,
                    onNext: _asking ? () {} : _permitirEComecar,
                    nextLabel: _asking ? 'Um instante…' : 'Bora começar',
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
