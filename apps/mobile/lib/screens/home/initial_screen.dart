import 'package:flutter/material.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/scribble_mark.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/motion/word_reveal_text.dart';

/// Capa do produto — a primeira tela de quem ainda não tem conta.
///
/// Duas coisas foram corrigidas junto com o redesenho:
///
/// * A tela **construía um `MaterialApp` dentro do `MaterialApp` do app**.
///   Isso criava um segundo `Navigator`, sem nenhuma rota registrada, então
///   os botões empurravam para um navegador que não conhecia `/register` nem
///   `/login`, e o tema/`themeMode` do app não valia aqui dentro.
/// * O conteúdo era uma `Column` de alturas fixas (logo de 250px + textos +
///   dois botões de 60px + 100px de respiro), que estoura em tela pequena.
///   Agora rola quando não cabe e o respiro é elástico.
///
/// Visualmente é um cartaz: manchete gigante entrando palavra por palavra,
/// mancha de spray atrás, grão por cima de tudo, e as duas ações no rodapé,
/// na zona do polegar.
class InitialScreen extends StatelessWidget {
  const InitialScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          Positioned(
            left: -120,
            top: -60,
            child: SprayGlow(color: colors.ambar, size: 380, intensity: 0.2),
          ),
          Positioned(
            right: -140,
            bottom: 40,
            child: SprayGlow(color: colors.brasa, size: 320, intensity: 0.16),
          ),
          const Positioned.fill(child: Grain(opacity: 0.05, density: 0.5)),

          SafeArea(
            child: LayoutBuilder(
              builder: (context, constraints) => SingleChildScrollView(
                child: ConstrainedBox(
                  constraints: BoxConstraints(minHeight: constraints.maxHeight),
                  // IntrinsicHeight dá altura definida à Column dentro do
                  // scroll, que é o que permite usar Spacer aqui: sem ele, o
                  // flex do Spacer recebe restrição infinita e estoura.
                  child: IntrinsicHeight(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.screen,
                        vertical: AppSpacing.xl,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Image.asset(
                            'assets/img/logo/tipografia.png',
                            height: 22,
                            fit: BoxFit.contain,
                            alignment: Alignment.centerLeft,
                          ),

                          const Spacer(),

                          Text(
                            'A CIDADE',
                            style: type.displayHuge.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                          Stack(
                            clipBehavior: Clip.none,
                            children: [
                              WordRevealText(
                                text: 'TÁ ROLANDO',
                                style: type.displayHuge.copyWith(
                                  color: colors.ambar,
                                ),
                              ),
                              Positioned(
                                left: -6,
                                bottom: -4,
                                child: ScribbleMark(
                                  shape: ScribbleShape.underline,
                                  color: colors.brasa,
                                  size: const Size(230, 16),
                                  strokeWidth: 3,
                                ),
                              ),
                            ],
                          ),

                          const SizedBox(height: AppSpacing.xl),
                          Text(
                            'Bares, baladas, restaurantes e eventos — o que '
                            'tá acontecendo agora, perto de você.',
                            style: type.bodyLarge.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),

                          const Spacer(),

                          VibesterButton(
                            label: 'Começar agora',
                            onPressed: () => Navigator.pushNamed(
                              context,
                              AppRoutes.register,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          VibesterButton(
                            label: 'Já tenho conta',
                            variant: VibesterButtonVariant.outline,
                            onPressed: () =>
                                Navigator.pushNamed(context, AppRoutes.login),
                          ),

                          const SizedBox(height: AppSpacing.xl),
                          Text.rich(
                            textAlign: TextAlign.center,
                            TextSpan(
                              style: type.monoMicro.copyWith(
                                color: colors.textDisabled,
                              ),
                              children: [
                                const TextSpan(
                                  text: 'AO CONTINUAR VOCÊ ACEITA OS ',
                                ),
                                TextSpan(
                                  text: 'TERMOS DE USO',
                                  style: TextStyle(color: colors.textMuted),
                                ),
                                const TextSpan(text: ' E A '),
                                TextSpan(
                                  text: 'POLÍTICA DE PRIVACIDADE',
                                  style: TextStyle(color: colors.textMuted),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
