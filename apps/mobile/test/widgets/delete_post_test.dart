import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/widgets/cards/highlights/post_detail_screen.dart';

import '../helpers/pump_app.dart';

/// A exclusão só pode ser oferecida no post do próprio usuário: o backend
/// recusa as outras (403), mas mostrar o botão prometeria uma ação que falha.
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

  testWidgets('dono vê o botão de excluir e a confirmação', (tester) async {
    await pumpScreen(
      tester,
      PostDetailScreen(posts: [postDe('account-1')]),
      user: fakeUser(),
    );

    await tester.tap(find.bySemanticsLabel('Excluir publicação'));
    await tester.pumpAndSettle();

    expect(find.text('Excluir publicação'), findsOneWidget);
    await tester.tap(find.text('Cancelar'));
    await tester.pumpAndSettle();
    expect(find.byType(AlertDialog), findsNothing);
  });

  testWidgets('post de outra pessoa não tem botão de excluir', (tester) async {
    await pumpScreen(
      tester,
      PostDetailScreen(posts: [postDe('outra-conta')]),
      user: fakeUser(),
    );

    expect(find.bySemanticsLabel('Excluir publicação'), findsNothing);
  });
}