import 'package:flutter/material.dart';

class AppColors extends ThemeExtension<AppColors> {
  final Color navy;
  final Color ambar;
  final Color grey;
  final Color darkGrey;
  final Color brasa;
  final Color noturno;

  const AppColors({
    required this.navy,
    required this.ambar,
    required this.grey,
    required this.darkGrey,
    required this.brasa,
    required this.noturno,
  });

  static const AppColors defaultColors = AppColors(
    navy: Color(0xFF17112A),
    ambar: Color(0xFFF88806),
    grey: Color(0xFF94A3B8),
    darkGrey: Color(0xFF0E0E0E),
    brasa: Color(0xFFFF4D1C),
    noturno: Color(0xFF0C0910),
  );

  @override
  AppColors copyWith({
    Color? navy,
    Color? ambar,
    Color? grey,
    Color? darkGrey,
    Color? brasa,
    Color? noturno,
  }) {
    return AppColors(
      navy: navy ?? this.navy,
      ambar: ambar ?? this.ambar,
      grey: grey ?? this.grey,
      darkGrey: darkGrey ?? this.darkGrey,
      brasa: brasa ?? this.brasa,
      noturno: noturno ?? this.noturno,
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
    );
  }
}
