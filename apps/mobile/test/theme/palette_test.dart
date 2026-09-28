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

    test('o tema claro usa o mesmo par de acento do escuro', () {
      // O que inverte no tema claro são as superfícies e os cinzas — o
      // acento não. Âmbar e brasa são os mesmos nos dois temas: é a marca, e
      // o app precisa se parecer consigo mesmo nos dois modos. (Houve uma
      // versão que espelhava o par em frio, ciano → índigo; foi desfeita de
      // propósito. Ver o comentário de `AppColors.light`.)
      const light = AppColors.light;

      expect(light.ambar, AppColors.dark.ambar);
      expect(light.brasa, AppColors.dark.brasa);
      expect(light.gradient.colors, [light.ambar, light.brasa]);
    });

    test('o claro inverte o papel e os cinzas, não o acento', () {
      // Guarda do que de fato distingue os dois temas: se alguém copiar o
      // `noturno`/`navy` escuro para cá, o tema claro deixa de existir.
      const light = AppColors.light;
      const dark = AppColors.dark;

      expect(light.noturno, isNot(dark.noturno));
      expect(light.navy, isNot(dark.navy));
      expect(light.grey, isNot(dark.grey));
      // Papel claro contra texto escuro — o oposto do tema escuro.
      expect(light.noturno.computeLuminance(), greaterThan(0.8));
      expect(light.textPrimary.computeLuminance(), lessThan(0.1));
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

    test('o photoFade desce de transparente a preto cheio', () {
      // O hero do lugar termina no fundo da tela, não numa borda de card: o
      // último stop precisa ser preto opaco, senão aparece costura entre a
      // foto e o conteúdo abaixo.
      final fade = AppColors.dark.photoFade;

      expect(fade.begin, Alignment.topCenter);
      expect(fade.end, Alignment.bottomCenter);
      expect(fade.colors.first.a, 0.0);
      expect(fade.colors.last, AppColors.dark.scrim);
      expect(fade.colors.last.a, 1.0);
      // Nos dois temas o véu é preto real — o texto do hero é branco fixo.
      expect(AppColors.light.photoFade.colors.last, AppColors.light.scrim);
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
