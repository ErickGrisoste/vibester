import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class CategoryIndicator extends StatelessWidget {
  final String categoria;

  const CategoryIndicator({super.key, required this.categoria});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: context.colors.noturno.withAlpha(50),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: context.colors.ambar.withAlpha(150)),
      ),
      child: Text(
        categoria,
        style: TextStyle(
          fontWeight: FontWeight.bold,
          color: context.colors.ambar,
          fontSize: 10,
        ),
      ),
    );
  }
}
