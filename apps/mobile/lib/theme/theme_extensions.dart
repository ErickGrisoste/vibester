import 'package:flutter/material.dart';
import 'package:mobile/theme/app_colors.dart';

extension AppColorsX on BuildContext {
  AppColors get colors => Theme.of(this).extension<AppColors>()!;
}
