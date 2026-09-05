import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/providers/theme/theme_provider.dart';
import 'package:mobile/service/theme/theme_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('ThemeProvider', () {
    test('estado inicial reflete o ThemeMode passado no construtor', () {
      final provider = ThemeProvider(ThemeMode.dark);

      expect(provider.themeMode, ThemeMode.dark);
      expect(provider.isDarkMode, isTrue);
    });

    test('toggleTheme alterna o modo e notifica os listeners', () async {
      final provider = ThemeProvider(ThemeMode.dark);
      var notified = false;
      provider.addListener(() => notified = true);

      await provider.toggleTheme();

      expect(provider.themeMode, ThemeMode.light);
      expect(provider.isDarkMode, isFalse);
      expect(notified, isTrue);
    });

    test(
      'setThemeMode persiste a escolha entre "sessões" (reinício do app)',
      () async {
        final provider = ThemeProvider(ThemeMode.dark);

        await provider.setThemeMode(ThemeMode.light);

        final reloaded = await ThemeService.loadThemeMode();
        expect(reloaded, ThemeMode.light);
      },
    );

    test(
      'loadThemeMode retorna ThemeMode.dark por padrão quando não há valor salvo',
      () async {
        final mode = await ThemeService.loadThemeMode();
        expect(mode, ThemeMode.dark);
      },
    );
  });
}
