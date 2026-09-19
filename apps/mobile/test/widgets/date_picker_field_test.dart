import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/utils/date_input.dart';
import 'package:mobile/widgets/text-field/date_picker_field.dart';

import '../helpers/pump_app.dart';

void main() {
  setUpAll(setUpTestEnvironment);

  group('BrDate', () {
    test('lê uma data completa', () {
      expect(BrDate.parse('01/02/1999'), DateTime(1999, 2, 1));
    });

    test('recusa data incompleta', () {
      expect(BrDate.parse('01/02/19'), isNull);
      expect(BrDate.parse(''), isNull);
    });

    test('recusa dia que não existe em vez de rolar para o mês seguinte', () {
      // DateTime(2023, 2, 29) vira 1º de março silenciosamente no Dart.
      expect(BrDate.parse('29/02/2023'), isNull);
      expect(BrDate.parse('31/04/2000'), isNull);
      expect(BrDate.parse('00/01/2000'), isNull);
      expect(BrDate.parse('01/13/2000'), isNull);
    });

    test('aceita 29 de fevereiro em ano bissexto', () {
      expect(BrDate.parse('29/02/2024'), DateTime(2024, 2, 29));
    });

    test('formata de volta com zero à esquerda', () {
      expect(BrDate.format(DateTime(1999, 2, 1)), '01/02/1999');
    });

    test('idade só conta o aniversário já ocorrido', () {
      final hoje = DateTime(2026, 6, 15);
      expect(BrDate.age(DateTime(2000, 6, 15), at: hoje), 26);
      expect(BrDate.age(DateTime(2000, 6, 16), at: hoje), 25);
      expect(BrDate.age(DateTime(2000, 12, 1), at: hoje), 25);
    });

    test('conhece o tamanho do mês', () {
      expect(BrDate.daysInMonth(2024, 2), 29);
      expect(BrDate.daysInMonth(2023, 2), 28);
      expect(BrDate.daysInMonth(2023, 4), 30);
    });
  });

  group('BrDateInputFormatter', () {
    String mascarar(String entrada) => const BrDateInputFormatter()
        .formatEditUpdate(
          TextEditingValue.empty,
          TextEditingValue(text: entrada),
        )
        .text;

    test('insere as barras sozinho', () {
      expect(mascarar('0'), '0');
      expect(mascarar('0101'), '01/01');
      expect(mascarar('01011999'), '01/01/1999');
    });

    test('ignora o que não é dígito e corta o excesso', () {
      expect(mascarar('01a01b1999'), '01/01/1999');
      expect(mascarar('010119991234'), '01/01/1999');
    });
  });

  group('DatePickerField', () {
    Widget campo({
      GlobalKey<FormState>? formKey,
      DateTime? initialDate,
      void Function(DateTime?)? onDateSelected,
    }) => Form(
      key: formKey,
      child: DatePickerField(
        labelText: 'Data de nascimento',
        initialDate: initialDate,
        onDateSelected: onDateSelected,
        validator: (value) =>
            value == null ? 'Informe sua data de nascimento' : null,
      ),
    );

    testWidgets('digitar a data preenche o valor e mostra a idade', (
      tester,
    ) async {
      DateTime? escolhida;
      await pumpComponent(
        tester,
        campo(onDateSelected: (data) => escolhida = data),
      );

      await tester.enterText(find.byType(TextField), '01011999');
      await tester.pump();

      expect(escolhida, DateTime(1999, 1, 1));
      expect(find.text('01/01/1999'), findsOneWidget);
      expect(
        find.text('${BrDate.age(DateTime(1999, 1, 1))} ANOS'),
        findsOneWidget,
      );
    });

    testWidgets('data incompleta reprova a validação do formulário', (
      tester,
    ) async {
      final formKey = GlobalKey<FormState>();
      await pumpComponent(tester, campo(formKey: formKey));

      await tester.enterText(find.byType(TextField), '0101');
      await tester.pump();

      expect(formKey.currentState!.validate(), isFalse);
      await tester.pump();
      expect(find.text('Complete a data (DD/MM/AAAA)'), findsOneWidget);
    });

    testWidgets('dia inexistente e data no futuro têm mensagem própria', (
      tester,
    ) async {
      final formKey = GlobalKey<FormState>();
      await pumpComponent(tester, campo(formKey: formKey));

      await tester.enterText(find.byType(TextField), '31022000');
      await tester.pump();
      expect(formKey.currentState!.validate(), isFalse);
      await tester.pump();
      expect(find.text('Esse dia não existe'), findsOneWidget);

      final amanha = DateTime.now().add(const Duration(days: 1));
      await tester.enterText(find.byType(TextField), BrDate.format(amanha));
      await tester.pump();
      expect(formKey.currentState!.validate(), isFalse);
      await tester.pump();
      expect(find.text('Essa data ainda não chegou'), findsOneWidget);
    });

    testWidgets('campo vazio cai no validador de quem usa o campo', (
      tester,
    ) async {
      final formKey = GlobalKey<FormState>();
      await pumpComponent(tester, campo(formKey: formKey));

      expect(formKey.currentState!.validate(), isFalse);
      await tester.pump();
      expect(find.text('Informe sua data de nascimento'), findsOneWidget);
    });

    testWidgets('corrigir a data apaga o erro sem novo submit', (tester) async {
      final formKey = GlobalKey<FormState>();
      await pumpComponent(tester, campo(formKey: formKey));

      expect(formKey.currentState!.validate(), isFalse);
      await tester.pump();
      expect(find.text('Informe sua data de nascimento'), findsOneWidget);

      await tester.enterText(find.byType(TextField), '01011999');
      await tester.pumpAndSettle();

      expect(find.text('Informe sua data de nascimento'), findsNothing);
      expect(formKey.currentState!.validate(), isTrue);
    });

    for (final entry in TestScreens.all.entries) {
      testWidgets('a roda cabe na tela ${entry.key}', (tester) async {
        await pumpComponent(
          tester,
          campo(initialDate: DateTime(1999, 9, 30)),
          size: entry.value,
        );

        await tester.tap(find.byIcon(Icons.calendar_today_outlined));
        await tester.pumpAndSettle();

        expect(find.text('Setembro'), findsWidgets);
        expect(find.text('Confirmar'), findsOneWidget);
      });
    }

    testWidgets('a roda escolhe a data e escreve no campo', (tester) async {
      DateTime? escolhida;
      await pumpComponent(
        tester,
        campo(
          initialDate: DateTime(1999, 1, 10),
          onDateSelected: (data) => escolhida = data,
        ),
      );

      await tester.tap(find.byIcon(Icons.calendar_today_outlined));
      await tester.pumpAndSettle();

      expect(find.text('Confirmar'), findsOneWidget);
      expect(find.text('Janeiro'), findsWidgets);

      await tester.drag(find.text('10').first, const Offset(0, -44));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Confirmar'));
      await tester.pumpAndSettle();

      expect(escolhida, isNotNull);
      expect(escolhida!.year, 1999);
      expect(escolhida!.month, 1);
      expect(escolhida!.day, greaterThan(10));
      expect(find.text(BrDate.format(escolhida!)), findsOneWidget);
    });
  });
}
