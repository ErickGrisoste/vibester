import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class PriceIndicator extends StatelessWidget {
  final String nivel;

  const PriceIndicator({super.key, required this.nivel});

  int get _quantidade => switch (nivel.toLowerCase()) {
    'baixo' => 1,
    'medio' => 2,
    'alto' => 3,
    _ => 1,
  };

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(3, (index) {
        return Text(
          '\$',
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.bold,
            color: index < _quantidade
                ? context.colors.textPrimary
                : context.colors.textDisabled,
          ),
        );
      }),
    );
  }
}
