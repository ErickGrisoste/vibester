import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Fio de separação.
///
/// Usa `context.colors.hairline` (derivado da paleta) em vez do
/// `Colors.white24` fixo de antes, que ficava invisível no tema claro.
class MyDivider extends StatelessWidget {
  final double width;
  final double height;

  const MyDivider({required this.height, required this.width, super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      color: context.colors.hairline,
    );
  }
}
