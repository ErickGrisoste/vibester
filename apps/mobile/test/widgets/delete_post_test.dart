import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/widgets/cards/highlights/post_detail_screen.dart';

import '../helpers/pump_app.dart';

/// A exclusão mora no ⋯ da publicação e só pode ser oferecida no post do
/// próprio usuário: o backend recusa as outras (403), mas mostrar a opção
/// prometeria uma ação que falha.
void main() {
  setUpAll(setUpTestEnvironment);

  HighlightModel postDe(String userId) => HighlightModel(
    postId: 'post-1',
    userId: userId,
    imagensUrls: const [],
    legenda: 'Noite boa demais.',
    totalCurtidas: 0,
    totalComentarios: 0,
    foiDeletado: false,
    criadoEm: DateTime.now().toIso8601String(),
    atualizadoEm: DateTime.now().toIso8601String(),
  );

  testWidgets('dono acha o excluir no ⋯ e vê a confirmação', (tester) async {
    await pumpScreen(
      tester,
      PostDetailScreen(posts: [postDe('account-1')]),
      user: fakeUser(),
    );

    // Fora do ⋯ não sobrou nenhum atalho de exclusão na tela.
    expect(find.bySemanticsLabel('Excluir publicação'), findsNothing);

    await tester.tap(find.bySemanticsLabel('Opções da publicação'));
    await tester.pumpAndSettle();

    await tester.tap(find.bySemanticsLabel('Excluir publicação'));
    await tester.pumpAndSettle();

    expect(find.byType(AlertDialog), findsOneWidget);
    expect(find.text('Excluir publicação'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('no ⋯ do post de outra pessoa não há excluir', (tester) async {
    await pumpScreen(
      tester,
      PostDetailScreen(posts: [postDe('outra-conta')]),
      user: fakeUser(),
    );

    await tester.tap(find.bySemanticsLabel('Opções da publicação'));
    await tester.pumpAndSettle();

    expect(find.bySemanticsLabel('Excluir publicação'), findsNothing);
    expect(find.bySemanticsLabel('Denunciar publicação'), findsOneWidget);
    expect(find.bySemanticsLabel('Bloquear perfil'), findsOneWidget);
  });
}