import 'package:flutter/material.dart';

class AppColors extends ThemeExtension<AppColors> {
  final Color navy;
  final Color ambar;
  final Color grey;
  final Color darkGrey;
  final Color brasa;
  final Color noturno;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textDisabled;
  final Color border;
  final Color error;

  const AppColors({
    required this.navy,
    required this.ambar,
    required this.grey,
    required this.darkGrey,
    required this.brasa,
    required this.noturno,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textDisabled,
    required this.border,
    required this.error,
  });

  /// Gradiente da marca, derivado de `ambar` e `brasa` do tema atual.
  ///
  /// Use em `BoxDecoration.gradient` para fundos, cards e botões; para texto
  /// e ícones use `GradientMask` (theme_extensions.dart).
  LinearGradient get gradient => LinearGradient(colors: [ambar, brasa]);

  static const AppColors dark = AppColors(
    navy: Color(0xFF17112A),
    ambar: Color(0xFFF88806),
    grey: Color(0xFF94A3B8),
    darkGrey: Color(0xFF0E0E0E),
    brasa: Color(0xFFFF4D1C),
    noturno: Color(0xFF0C0910),
    textPrimary: Colors.white,
    textSecondary: Colors.white70,
    textMuted: Colors.white54,
    textDisabled: Colors.white38,
    border: Colors.white38,
    error: Color(0xFFFF5252),
  );

  static const AppColors light = AppColors(
    navy: Color.fromARGB(255, 136, 123, 179),
    ambar: Color(0xFFF88806),
    grey: Color(0xFF94A3B8),
    darkGrey: Color(0xFFF0EDF5),
    brasa: Color(0xFFFF4D1C),
    noturno: Color(0xFFFFFFFF),
    textPrimary: Color(0xFF17112A),
    textSecondary: Color(0xFF4B4560),
    textMuted: Color(0xFF6B6580),
    textDisabled: Color(0xFF9A94AC),
    border: Color(0xFFD8D3E0),
    error: Color(0xFFD32F2F),
  );

  /// Alias mantido para não quebrar código legado que ainda referencie o
  /// nome antigo; equivale ao tema escuro (paleta original do app).
  static const AppColors defaultColors = dark;

  @override
  AppColors copyWith({
    Color? navy,
    Color? ambar,
    Color? grey,
    Color? darkGrey,
    Color? brasa,
    Color? noturno,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? textDisabled,
    Color? border,
    Color? error,
  }) {
    return AppColors(
      navy: navy ?? this.navy,
      ambar: ambar ?? this.ambar,
      grey: grey ?? this.grey,
      darkGrey: darkGrey ?? this.darkGrey,
      brasa: brasa ?? this.brasa,
      noturno: noturno ?? this.noturno,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      textDisabled: textDisabled ?? this.textDisabled,
      border: border ?? this.border,
      error: error ?? this.error,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      navy: Color.lerp(navy, other.navy, t)!,
      ambar: Color.lerp(ambar, other.ambar, t)!,
      grey: Color.lerp(grey, other.grey, t)!,
      darkGrey: Color.lerp(darkGrey, other.darkGrey, t)!,
      brasa: Color.lerp(brasa, other.brasa, t)!,
      noturno: Color.lerp(noturno, other.noturno, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
      border: Color.lerp(border, other.border, t)!,
      error: Color.lerp(error, other.error, t)!,
    );
  }
}