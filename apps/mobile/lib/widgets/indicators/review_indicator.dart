import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Nota em estrelas. Meia estrela quando a média cai no meio.
///
/// Usado por [ReviewCard] (avaliação de evento).
class StarRating extends StatelessWidget {
  final double rating;
  final double size;

  const StarRating({super.key, required this.rating, this.size = 15});

  @override
  Widget build(BuildContext context) {
    return Semantics(
      label: 'Nota ${rating.toStringAsFixed(1)} de 5',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 1; i <= 5; i++)
            Padding(
              padding: const EdgeInsets.only(right: 2),
              child: Icon(
                rating >= i
                    ? Icons.star_rounded
                    : rating >= i - 0.5
                    ? Icons.star_half_rounded
                    : Icons.star_outline_rounded,
                size: size,
                color: rating >= i - 0.5
                    ? context.colors.ambar
                    : context.colors.textDisabled,
              ),
            ),
        ],
      ),
    );
  }
}
