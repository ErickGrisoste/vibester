import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';

class ThemeService {
  static const _themeModeKey = 'theme_mode';

  static Future<ThemeMode> loadThemeMode() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final value = prefs.getString(_themeModeKey);
      return value == 'light' ? ThemeMode.light : ThemeMode.dark;
    } catch (_) {
      return ThemeMode.dark;
    }
  }

  static Future<void> saveThemeMode(ThemeMode mode) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(
        _themeModeKey,
        mode == ThemeMode.light ? 'light' : 'dark',
      );
    } catch (_) {
      // Preferência de UI não-crítica: falha de escrita é ignorada.
    }
  }
}
