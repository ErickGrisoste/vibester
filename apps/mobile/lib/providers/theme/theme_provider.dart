import 'package:flutter/material.dart';
import 'package:mobile/service/theme/theme_service.dart';

class ThemeProvider extends ChangeNotifier {
  ThemeMode _themeMode;

  ThemeProvider(ThemeMode initialThemeMode) : _themeMode = initialThemeMode;

  ThemeMode get themeMode => _themeMode;
  bool get isDarkMode => _themeMode == ThemeMode.dark;

  Future<void> setThemeMode(ThemeMode mode) async {
    if (mode == _themeMode) return;
    _themeMode = mode;
    notifyListeners();
    await ThemeService.saveThemeMode(mode);
  }

  Future<void> toggleTheme() {
    return setThemeMode(isDarkMode ? ThemeMode.light : ThemeMode.dark);
  }
}
