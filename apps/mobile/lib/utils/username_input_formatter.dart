import 'package:diacritic/diacritic.dart';
import 'package:flutter/services.dart';

/// Normaliza o nome de usuário enquanto a pessoa digita: tudo minúsculo e sem
/// acento ("João" vira "joao"). Troca a letra em vez de recusar a tecla, então
/// quem digita um acento não perde o caractere.
class UsernameInputFormatter extends TextInputFormatter {
  const UsernameInputFormatter();

  static String normalize(String value) =>
      removeDiacritics(value.toLowerCase());

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    final text = normalize(newValue.text);
    if (text == newValue.text) return newValue;

    // Letra decomposta (e + acento combinante) encolhe o texto; o cursor
    // acompanha a diferença para não ficar além do fim.
    final delta = newValue.text.length - text.length;
    int shift(int offset) => (offset - delta).clamp(0, text.length);

    return TextEditingValue(
      text: text,
      selection: newValue.selection.isValid
          ? TextSelection(
              baseOffset: shift(newValue.selection.baseOffset),
              extentOffset: shift(newValue.selection.extentOffset),
            )
          : TextSelection.collapsed(offset: text.length),
    );
  }
}
