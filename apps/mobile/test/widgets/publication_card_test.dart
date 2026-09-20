import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/widgets/cards/feed/publication_card.dart';

import '../helpers/pump_app.dart';

/// O ⋯ do cartão do feed é ancorado na borda direita, e é fácil quebrar isso
/// sem perceber: um `Spacer` ao lado de um filho `Flexible` divide o espaço
/// livre entre os dois, e o botão passa a andar junto com o tamanho do @.
void main() {
  setUpAll(setUpTestEnvironment);

  PublicationModel deOutraPessoa(String autor) => PublicationModel(
    id: 'post-1',
    authorId: 'outra-conta',
    autor: autor,
    autorProfileImage: '',
    publicationImage: '',
    description: 'Ontem foi bom demais.',
    publicatedAt: DateTime(2026, 9, 1),
    likes: 4,
  );

  Future<double> bordaDireitaDoMenu(
    WidgetTester tester,
    String autor, {
    Size size = TestScreens.medium,
  }) async {
    await pumpScreen(
      tester,
      Scaffold(body: PublicationCard(publication: deOutraPessoa(autor))),
      user: fakeUser(),
      size: size,
    );

    final menu = find.byIcon(Icons.more_horiz_rounded);
    expect(menu, findsOneWidget, reason: 'post de outra pessoa mostra o ⋯');
    return tester.getTopRight(menu).dx;
  }

  for (final entry in TestScreens.all.entries) {
    testWidgets('⋯ fica na mesma borda com @ curto e longo em ${entry.key}', (
      tester,
    ) async {
      final comCurto = await bordaDireitaDoMenu(
        tester,
        'ana',
        size: entry.value,
      );
      final comLongo = await bordaDireitaDoMenu(
        tester,
        'mariana_fernandes_de_oliveira_2026',
        size: entry.value,
      );

      expect(
        comCurto,
        comLongo,
        reason: 'o ⋯ não pode andar com o tamanho do nome',
      );

      // E está de fato encostado na direita: o que sobra é a margem da tela
      // mais o respiro do próprio alvo de toque, nunca metade da linha.
      final folga = entry.value.width - comCurto;
      expect(folga, lessThan(AppSpacing.screen + 16));
    });
  }

  testWidgets('post do próprio usuário mantém o ⋯ na borda', (tester) async {
    await pumpScreen(
      tester,
      Scaffold(
        body: PublicationCard(
          publication: PublicationModel(
            id: 'post-2',
            authorId: 'account-1',
            autor: 'ana',
            autorProfileImage: '',
            publicationImage: '',
            description: '',
            publicatedAt: DateTime(2026, 9, 1),
          ),
        ),
      ),
      user: fakeUser(),
    );

    final menu = find.byIcon(Icons.more_horiz_rounded);
    expect(menu, findsOneWidget);
    final folga = TestScreens.medium.width - tester.getTopRight(menu).dx;
    expect(folga, lessThan(AppSpacing.screen + 16));
  });
}
