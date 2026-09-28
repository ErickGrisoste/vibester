import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/place/place_category_covers.dart';
import 'package:mobile/screens/explore/explore_screen.dart';

import '../helpers/pump_app.dart';

/// TAMANHO DOS RÓTULOS: os nomes das seis categorias da BUSCA ficam sempre
/// numa linha e todos do mesmo tamanho. Se algum não cabe no aparelho, os
/// seis diminuem juntos.
void main() {
  setUpAll(setUpTestEnvironment);

  final rotulos = [
    for (final (nome, _) in placeCategoryCovers) nome.toUpperCase(),
  ];

  /// Tamanho da fonte de cada rótulo, na ordem das categorias.
  List<double> tamanhos(WidgetTester tester) => [
    for (final r in rotulos) tester.widget<Text>(find.text(r)).style!.fontSize!,
  ];

  /// O rótulo cabe inteiro na largura que recebeu: a largura que o texto
  /// pediria numa linha não passa da largura que ele tem.
  bool cabe(WidgetTester tester, String rotulo) {
    final paragrafo = tester.renderObject<RenderParagraph>(find.text(rotulo));
    final precisaria = paragrafo.getMaxIntrinsicWidth(double.infinity);
    return precisaria <= paragrafo.size.width + 0.5;
  }

  // Altura grande para o mosaico inteiro ser montado de uma vez.
  const estreita = Size(320, 1600);
  const larga = Size(800, 1600);

  testWidgets('tela estreita e fonte do sistema grande: tudo cabe, igual', (
    tester,
  ) async {
    tester.platformDispatcher.textScaleFactorTestValue = 1.3;
    addTearDown(tester.platformDispatcher.clearTextScaleFactorTestValue);

    await pumpScreen(tester, const ExploreScreen(), size: estreita);

    for (final r in rotulos) {
      expect(cabe(tester, r), isTrue, reason: '$r estourou a linha');
    }

    final t = tamanhos(tester);
    expect(
      t.toSet(),
      hasLength(1),
      reason: 'os seis devem ter o mesmo tamanho',
    );
    expect(t.first, lessThan(21), reason: 'aqui precisava diminuir');
  });

  testWidgets('tela larga: tamanho normal, sem redução', (tester) async {
    await pumpScreen(tester, const ExploreScreen(), size: larga);

    for (final r in rotulos) {
      expect(cabe(tester, r), isTrue, reason: '$r estourou a linha');
    }
    expect(tamanhos(tester).toSet(), {21});
  });
}