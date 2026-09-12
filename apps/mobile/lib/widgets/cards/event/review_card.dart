import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/indicators/review_indicator.dart';

/// Avaliação de um estabelecimento.
///
/// Sem cartão em volta: a coluna de avaliações vira uma sequência de blocos
/// de texto separados por fio, que é como uma página de opiniões se lê. A nota
/// em estrelas e o tempo ficam na mesma linha do nome, em DM Mono, e o
/// comentário fica sozinho embaixo — o conteúdo que importa é ele.
class ReviewCard extends StatelessWidget {
  final String nomeUsuario;
  final double avaliacao;
  final String comentario;
  final String tempo;

  const ReviewCard({
    super.key,
    required this.nomeUsuario,
    required this.avaliacao,
    required this.comentario,
    required this.tempo,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.hairline)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  nomeUsuario,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: type.titleMedium.copyWith(color: colors.textPrimary),
                ),
              ),
              Text(
                tempo.toUpperCase(),
                style: type.monoMicro.copyWith(color: colors.textDisabled),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          StarRating(rating: avaliacao),
          if (comentario.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              comentario,
              style: type.bodyLarge.copyWith(color: colors.textSecondary),
            ),
          ],
        ],
      ),
    );
  }
}
