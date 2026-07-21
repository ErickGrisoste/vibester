import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/theme/app_colors.dart';

class AppTheme {
  AppTheme._();

  static final ThemeData light = ThemeData(
    textTheme: GoogleFonts.interTextTheme(),
    fontFamily: GoogleFonts.inter().fontFamily,
    extensions: const [AppColors.defaultColors],
  );
}
