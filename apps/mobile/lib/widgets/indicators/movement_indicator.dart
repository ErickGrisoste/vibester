import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class MovimentoIndicator extends StatelessWidget {
  final int nivel;
  const MovimentoIndicator({super.key, required this.nivel});

  @override
  Widget build(BuildContext context) {
    Color _getColor(int nivel) {
      if (nivel <= 2) return context.colors.brasa.withAlpha(150);
      if (nivel <= 3) return context.colors.brasa.withAlpha(70);
      return context.colors.brasa;
    }

    return Row(
      children: List.generate(5, (index) {
        return Container(
          margin: EdgeInsets.symmetric(horizontal: 2),
          width: 16,
          height: 9,
          decoration: BoxDecoration(
            color: index < nivel ? _getColor(nivel) : context.colors.noturno,
            borderRadius: BorderRadius.circular(2),
            boxShadow: [
              BoxShadow(
                color: context.colors.brasa.withOpacity(0.6),
                blurRadius: 10,
                offset: const Offset(0, 1),
                spreadRadius: 1,
              ),
            ],
            border: BoxBorder.all(color: context.colors.brasa, width: 1),
          ),
        );
      }),
    );
  }
}
