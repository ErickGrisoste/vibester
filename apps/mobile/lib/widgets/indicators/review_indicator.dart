import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class ReviewIndicator extends StatelessWidget {
  final double avaliacao;
  final int totalReviews;
  final List<double> distribuicao;

  const ReviewIndicator({
    super.key,
    required this.avaliacao,
    this.totalReviews = 0,
    this.distribuicao = const [],
  });

  List<double> get _distribuicaoSegura =>
      distribuicao.length == 5 ? distribuicao : const [0, 0, 0, 0, 0];

  @override
  Widget build(BuildContext context) {
    final dist = _distribuicaoSegura;

    return Card(
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      clipBehavior: Clip.antiAlias,
      color: context.colors.navy,
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Lado esquerdo
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  avaliacao.toStringAsFixed(1),
                  style: TextStyle(
                    color: context.colors.textPrimary,
                    fontSize: 52,
                    fontWeight: FontWeight.bold,
                    height: 1,
                  ),
                ),
                const SizedBox(height: 8),
                _buildStars(context, avaliacao),
                const SizedBox(height: 6),
                Text(
                  '$totalReviews reviews',
                  style: TextStyle(
                    color: context.colors.textMuted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),

            const SizedBox(width: 24),

            // Lado direito
            Expanded(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(5, (i) {
                  final estrela = 5 - i;
                  final percent = dist[i];
                  return _buildBarRow(context, estrela, percent);
                }),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStars(BuildContext context, double rating) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(5, (i) {
        final starValue = i + 1;
        IconData icon;
        if (rating >= starValue) {
          icon = Icons.star;
        } else if (rating >= starValue - 0.5) {
          icon = Icons.star_half;
        } else {
          icon = Icons.star_border;
        }
        return Icon(icon, color: context.colors.brasa, size: 16);
      }),
    );
  }

  Widget _buildBarRow(BuildContext context, int estrela, double percent) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 3),
      child: Row(
        children: [
          SizedBox(
            width: 12,
            child: Text(
              '$estrela',
              style: TextStyle(color: context.colors.textMuted, fontSize: 12),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(4),
              child: LinearProgressIndicator(
                value: percent,
                minHeight: 6,
                backgroundColor: context.colors.border,
                valueColor: AlwaysStoppedAnimation<Color>(context.colors.brasa),
              ),
            ),
          ),
          const SizedBox(width: 8),
          SizedBox(
            width: 32,
            child: Text(
              '${(percent * 100).toInt()}%',
              style: TextStyle(color: context.colors.textMuted, fontSize: 12),
              textAlign: TextAlign.right,
            ),
          ),
        ],
      ),
    );
  }
}
