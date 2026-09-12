import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/theme/app_colors.dart';
import 'package:mobile/theme/app_spacing.dart';

class AppTheme {
  AppTheme._();

  /// Fonte principal do produto (ver `app_typography.dart`). Aplicada
  /// globalmente para que qualquer `Text` sem estilo explícito já nasça em
  /// Outfit — DM Mono é sempre opt-in, via os tokens `context.typography.mono*`.
  static const _fontFamily = 'Outfit';

  static ThemeData _build(AppColors colors, Brightness brightness) {
    final base = ThemeData(brightness: brightness);

    return ThemeData(
      brightness: brightness,
      fontFamily: _fontFamily,
      textTheme: base.textTheme.apply(fontFamily: _fontFamily),
      scaffoldBackgroundColor: colors.noturno,
      canvasColor: colors.noturno,
      splashColor: colors.ambar.withValues(alpha: 0.10),
      highlightColor: colors.ambar.withValues(alpha: 0.05),
      colorScheme:
          ColorScheme.fromSeed(
            seedColor: colors.ambar,
            brightness: brightness,
          ).copyWith(
            primary: colors.ambar,
            secondary: colors.brasa,
            surface: colors.noturno,
            error: colors.error,
          ),
      // O app desenha o próprio topo em quase toda tela (headers editoriais),
      // então o AppBar padrão precisa ser invisível onde ainda for usado.
      appBarTheme: AppBarTheme(
        backgroundColor: colors.noturno,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        scrolledUnderElevation: 0,
        centerTitle: false,
        foregroundColor: colors.textPrimary,
        systemOverlayStyle: brightness == Brightness.dark
            ? SystemUiOverlayStyle.light
            : SystemUiOverlayStyle.dark,
      ),
      bottomSheetTheme: BottomSheetThemeData(
        backgroundColor: colors.surfaceRaised,
        surfaceTintColor: Colors.transparent,
        shape: const RoundedRectangleBorder(borderRadius: AppRadius.sheet),
        showDragHandle: true,
        dragHandleColor: colors.textDisabled,
      ),
      dividerTheme: DividerThemeData(
        color: colors.hairline,
        thickness: 1,
        space: 1,
      ),
      snackBarTheme: SnackBarThemeData(
        backgroundColor: colors.surfaceRaised,
        contentTextStyle: TextStyle(
          fontFamily: _fontFamily,
          color: colors.textPrimary,
          fontSize: 14,
          fontWeight: FontWeight.w500,
        ),
        behavior: SnackBarBehavior.floating,
        insetPadding: const EdgeInsets.fromLTRB(16, 0, 16, 96),
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(14)),
        ),
      ),
      progressIndicatorTheme: ProgressIndicatorThemeData(color: colors.ambar),
      textSelectionTheme: TextSelectionThemeData(
        cursorColor: colors.ambar,
        selectionColor: colors.ambar.withValues(alpha: 0.3),
        selectionHandleColor: colors.ambar,
      ),
      extensions: [colors],
    );
  }

  static final ThemeData dark = _build(AppColors.dark, Brightness.dark);
  static final ThemeData light = _build(AppColors.light, Brightness.light);
}
