import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/motion/word_reveal_text.dart';
import 'package:mobile/widgets/onboarding/onboarding_footer.dart';

/// ONBOARDING 2 — de onde vem o movimento.
///
/// Esta tela já foi um seletor de vibes, mas a mesma pergunta passou a ser
/// feita no cadastro ("O que você curte?"), e o usuário respondia duas vezes
/// seguidas — na segunda com a resposta anterior já marcada, parecendo que o
/// app tinha esquecido. A escolha ficou onde ela é passo obrigatório do fluxo,
/// e o onboarding recuperou a vaga.
///
/// O que entrou no lugar é o elo que faltava entre as outras duas. A tela 1
/// promete "o movimento de cada lugar em tempo real" e nunca diz de onde esse
/// movimento sai; a tela 3 pede localização para posicionar o usuário. Esta
/// aqui responde a pergunta do meio — o movimento são as pessoas — e transforma
/// três cartazes soltos numa sequência: a cidade existe, ela é feita por gente,
/// e a localização te coloca dentro dela.
///
/// Segue a estrutura das outras duas — glow, grão, manchete em caixa alta com
/// a última linha em âmbar, parágrafo, rodapé. O que a distingue é o lugar da
/// luz e a ausência de marcação à mão: a tela 1 tem o sublinhado, a 3 tem o
/// ícone, esta fica só com a manchete. Assim as três são a mesma família sem
/// serem a mesma imagem.
///
/// Só menciona o que o app faz hoje: check-in, publicação e seguir perfis.
/// Vibe check e "amigos na área" ficam de fora enquanto estiverem como "em
/// breve" nos ajustes — prometer no onboarding o que o usuário não acha depois
/// é o jeito mais rápido de queimar a confiança na primeira sessão.
class OnboardingCentralOneScreen extends StatelessWidget {
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
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          // A luz percorre a sequência: tela 1 no alto à esquerda, esta no
          // meio à direita, tela 3 embaixo à direita.
          Positioned(
            right: -130,
            top: 230,
            child: SprayGlow(color: colors.brasa, size: 330, intensity: 0.18),
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
                    'A CIDADE',
                    style: type.displayHuge.copyWith(color: colors.textPrimary),
                  ),
                  Text(
                    'INTEIRA',
                    style: type.displayHuge.copyWith(color: colors.textPrimary),
                  ),
                  WordRevealText(
                    text: 'NUM FEED',
                    style: type.displayHuge.copyWith(color: colors.ambar),
                  ),

                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    'Pesquisas não te contam se o rolê tá bom. Quem tá lá conta. '
                    'Segue a galera que curte o que você curte e vê a noite '
                    'acontecer em tempo real com nosso feed!',
                    style: type.bodyLarge.copyWith(color: colors.textSecondary),
                  ),

                  const Spacer(),

                  OnboardingFooter(
                    step: 1,
                    total: 3,
                    onBack: onBack,
                    onNext: onNext,
                    nextLabel: 'Próximo',
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