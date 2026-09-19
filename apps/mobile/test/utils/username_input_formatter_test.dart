import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/utils/username_input_formatter.dart';

void main() {
  const formatter = UsernameInputFormatter();

  TextEditingValue digitar(String texto) => formatter.formatEditUpdate(
    TextEditingValue.empty,
    TextEditingValue(
      text: texto,
      selection: TextSelection.collapsed(offset: texto.length),
    ),
  );

  test('troca maiúscula e acento pela letra simples', () {
    expect(digitar('João Côrtes').text, 'joao cortes');
    expect(digitar('ÇÃO').text, 'cao');
  });

  test('não mexe no que já está normalizado', () {
    final valor = digitar('vibester_01');
    expect(valor.text, 'vibester_01');
    expect(valor.selection.baseOffset, 11);
  });

  test('cursor não passa do fim quando o acento é combinante', () {
    // "e" + U+0301 (acento agudo combinante): dois code units viram um.
    final valor = digitar('José');
    expect(valor.text, 'jose');
    expect(valor.selection.baseOffset, 4);
  });
}
