import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/utils/age.dart';

void main() {
  final hoje = DateTime(2026, 9, 14, 23, 59);

  test('aceita quem faz 18 anos hoje', () {
    expect(hasMinimumAge(DateTime(2008, 9, 14), now: hoje), isTrue);
  });

  test('recusa quem faz 18 anos amanhã', () {
    expect(hasMinimumAge(DateTime(2008, 9, 15), now: hoje), isFalse);
  });

  test('aceita adulto e recusa data futura', () {
    expect(hasMinimumAge(DateTime(1990, 1, 1), now: hoje), isTrue);
    expect(hasMinimumAge(DateTime(2030, 1, 1), now: hoje), isFalse);
  });

  test('nascido em 29/02 completa 18 anos em 01/03 de ano não bissexto', () {
    expect(
      hasMinimumAge(DateTime(2008, 2, 29), now: DateTime(2026, 2, 28)),
      isFalse,
    );
    expect(
      hasMinimumAge(DateTime(2008, 2, 29), now: DateTime(2026, 3, 1)),
      isTrue,
    );
  });
}
