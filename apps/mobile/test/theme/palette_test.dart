import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/theme/app_colors.dart';
import 'package:mobile/theme/app_theme.dart';

/// A paleta é a única restrição visual absoluta do produto: ela pode ganhar
/// tons derivados, mas os seis tokens de marca não mudam de valor. Este teste
/// existe para que uma alteração acidental (ou uma "melhoria" de contraste bem
/// intencionada) reprove no CI em vez de chegar em produção.
void main() {
  group('paleta da marca', () {
    test('os tokens do tema escuro mantêm os valores originais', () {
      const dark = AppColors.dark;

      expect(dark.navy, const Color(0xFF17112A));
      expect(dark.ambar, const Color(0xFFF88806));
      expect(dark.grey, const Color(0xFF94A3B8));
      expect(dark.darkGrey, const Color(0xFF0E0E0E));
      expect(dark.brasa, const Color(0xFFFF4D1C));
      expect(dark.noturno, const Color(0xFF0C0910));
    });

    test('âmbar e brasa são idênticos nos dois temas', () {
      // São cor de marca: não clareiam nem escurecem conforme o tema.
      expect(AppColors.light.ambar, AppColors.dark.ambar);
      expect(AppColors.light.brasa, AppColors.dark.brasa);
    });

    test('as superfícies derivadas saem da paleta, não de cor nova', () {
      const dark = AppColors.dark;

      // background é o próprio fundo da marca.
      expect(dark.background, dark.noturno);
      // live é o alias semântico de brasa.
      expect(dark.live, dark.brasa);
      // surface e surfaceRaised são navy diluído sobre noturno: ficam entre os
      // dois, nunca fora deles.
      expect(dark.surface, isNot(dark.noturno));
      expect(dark.surfaceRaised, isNot(dark.navy));
      expect(dark.hairline.a, lessThan(dark.grey.a));
    });

    test('o gradiente da marca continua indo de âmbar a brasa', () {
      expect(AppColors.dark.gradient.colors, [
        AppColors.dark.ambar,
        AppColors.dark.brasa,
      ]);
    });
  });

  group('tema', () {
    test('usa Outfit como fonte global nos dois modos', () {
      expect(AppTheme.dark.textTheme.bodyMedium?.fontFamily, 'Outfit');
      expect(AppTheme.light.textTheme.bodyMedium?.fontFamily, 'Outfit');
    });

    test('expõe AppColors como extensão em cada modo', () {
      expect(AppTheme.dark.extension<AppColors>(), AppColors.dark);
      expect(AppTheme.light.extension<AppColors>(), AppColors.light);
    });

    test('o fundo do Scaffold é o noturno do respectivo tema', () {
      expect(AppTheme.dark.scaffoldBackgroundColor, AppColors.dark.noturno);
      expect(AppTheme.light.scaffoldBackgroundColor, AppColors.light.noturno);
    });
  });
}
