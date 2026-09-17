import 'package:flutter/services.dart';

/// Entrada de data no formato brasileiro (`DD/MM/AAAA`).
///
/// Fica separado do widget porque é lógica pura: digitar uma data é um
/// problema de texto (máscara, dia que não existe, ano incompleto), não de
/// pintura. Assim o campo só desenha, e a regra pode ser testada sozinha.
class BrDate {
  BrDate._();

  /// Máscara completa, o que o usuário vê como dica.
  static const mask = 'DD/MM/AAAA';

  /// Quantidade de dígitos de uma data completa.
  static const digits = 8;

  /// Menor ano aceitável. Abaixo disso é erro de digitação, não idade.
  static const minYear = 1900;

  /// Converte `DD/MM/AAAA` em [DateTime], ou `null` se o texto estiver
  /// incompleto ou descrever um dia que não existe (31/02, 31/04...).
  ///
  /// `DateTime(2024, 2, 31)` no Dart vira 2 de março silenciosamente — por
  /// isso a checagem de volta nos três componentes.
  static DateTime? parse(String text) {
    final onlyDigits = text.replaceAll(RegExp(r'\D'), '');
    if (onlyDigits.length != digits) return null;

    final dia = int.parse(onlyDigits.substring(0, 2));
    final mes = int.parse(onlyDigits.substring(2, 4));
    final ano = int.parse(onlyDigits.substring(4, 8));

    if (mes < 1 || mes > 12 || dia < 1) return null;

    final data = DateTime(ano, mes, dia);
    if (data.year != ano || data.month != mes || data.day != dia) return null;

    return data;
  }

  /// [DateTime] em `DD/MM/AAAA`.
  static String format(DateTime data) {
    final dia = data.day.toString().padLeft(2, '0');
    final mes = data.month.toString().padLeft(2, '0');
    return '$dia/$mes/${data.year.toString().padLeft(4, '0')}';
  }

  /// Idade completa em anos numa data de referência (padrão: hoje).
  static int age(DateTime nascimento, {DateTime? at}) {
    final hoje = at ?? DateTime.now();
    var anos = hoje.year - nascimento.year;
    final fezAniversario =
        hoje.month > nascimento.month ||
        (hoje.month == nascimento.month && hoje.day >= nascimento.day);
    if (!fezAniversario) anos--;
    return anos;
  }

  /// Quantos dias tem o mês — usado pela roda para não oferecer 31 de abril
  /// nem 29 de fevereiro fora de ano bissexto.
  static int daysInMonth(int ano, int mes) => DateTime(ano, mes + 1, 0).day;
}

/// Insere as barras enquanto a pessoa digita, aceitando só dígitos.
///
/// O teclado é numérico, então não há `/` para digitar: quem escreve
/// `01011999` vê `01/01/1999` aparecer sozinho. Apagar funciona pelo mesmo
/// caminho — o texto é sempre remontado a partir dos dígitos, nunca editado
/// caractere a caractere.
class BrDateInputFormatter extends TextInputFormatter {
  const BrDateInputFormatter();

  @override
  TextEditingValue formatEditUpdate(
    TextEditingValue oldValue,
    TextEditingValue newValue,
  ) {
    var onlyDigits = newValue.text.replaceAll(RegExp(r'\D'), '');
    if (onlyDigits.length > BrDate.digits) {
      onlyDigits = onlyDigits.substring(0, BrDate.digits);
    }

    final buffer = StringBuffer();
    for (var i = 0; i < onlyDigits.length; i++) {
      if (i == 2 || i == 4) buffer.write('/');
      buffer.write(onlyDigits[i]);
    }

    final text = buffer.toString();
    return TextEditingValue(
      text: text,
      selection: TextSelection.collapsed(offset: text.length),
    );
  }
}
