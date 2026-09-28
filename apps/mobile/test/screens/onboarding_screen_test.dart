import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/screens/onboarding/onboarding_content.dart';
import 'package:mobile/screens/onboarding/onboarding_screen.dart';

import '../helpers/pump_app.dart';

/// Onboarding: as quatro páginas em três larguras e dois temas, e a
/// navegação (avançar, swipe, pular, voltar).
///
/// Sem rede no teste, eventos e lugares chegam vazios — é o caminho das
/// silhuetas e das capas de categoria, que precisa caber igual ao de dados.
void main() {
  setUpAll(setUpTestEnvironment);

  Future<void> settle(WidgetTester tester) async {
    await tester.pump();
    await tester.pump(const Duration(seconds: 2));
  }

  String counter(int page) =>
      '${(page + 1).toString().padLeft(2, '0')} / '
      '${onboardingSlides.length.toString().padLeft(2, '0')}';

  for (final theme in [ThemeMode.dark, ThemeMode.light]) {
    for (final tela in TestScreens.all.entries) {
      testWidgets('todas as páginas cabem em ${tela.key} (${theme.name})', (
        tester,
      ) async {
        await pumpScreen(
          tester,
          const OnboardingScreen(),
          size: tela.value,
          themeMode: theme,
        );

        for (var page = 0; page < onboardingSlides.length; page++) {
          expect(find.text(counter(page)), findsOneWidget);
          expect(find.text(onboardingSlides[page].eyebrow), findsOneWidget);
          expect(tester.takeException(), isNull);

          if (page < onboardingSlides.length - 1) {
            await tester.tap(find.text(onboardingSlides[page].cta));
            await settle(tester);
          }
        }
      });
    }
  }

  testWidgets('swipe avança e o voltar do sistema recua uma página', (
    tester,
  ) async {
    await pumpScreen(tester, const OnboardingScreen());

    await tester.fling(find.byType(PageView), const Offset(-300, 0), 1000);
    await settle(tester);
    expect(find.text(counter(1)), findsOneWidget);

    await tester.binding.handlePopRoute();
    await settle(tester);
    expect(find.text(counter(0)), findsOneWidget);
    expect(find.text(onboardingSlides[0].eyebrow), findsOneWidget);
  });

  testWidgets('pular leva à última página, que troca o pular pelo CTA final', (
    tester,
  ) async {
    await pumpScreen(tester, const OnboardingScreen());
    expect(find.text('PULAR'), findsOneWidget);

    await tester.tap(find.text('PULAR'));
    await settle(tester);

    final last = onboardingSlides.last;
    expect(find.text(counter(onboardingSlides.length - 1)), findsOneWidget);
    expect(find.text(last.cta), findsOneWidget);
    expect(find.text('PULAR'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets('com movimento reduzido o conteúdo aparece sem esperar entrada', (
    tester,
  ) async {
    tester.platformDispatcher.accessibilityFeaturesTestValue =
        const FakeAccessibilityFeatures(disableAnimations: true);
    addTearDown(tester.platformDispatcher.clearAccessibilityFeaturesTestValue);

    await pumpScreen(tester, const OnboardingScreen());
    await tester.tap(find.text(onboardingSlides[0].cta));
    // Um frame só: sem animação, a página 2 já tem que estar inteira.
    await tester.pump();
    await tester.pump();

    expect(find.text(counter(1)), findsOneWidget);
    final eyebrow = find.text(onboardingSlides[1].eyebrow);
    final opacity = tester.widget<Opacity>(
      find.ancestor(of: eyebrow, matching: find.byType(Opacity)).first,
    );
    expect(opacity.opacity, 1);
  });
}
