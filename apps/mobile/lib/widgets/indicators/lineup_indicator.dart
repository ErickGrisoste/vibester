import 'package:flutter/material.dart';
import 'package:mobile/models/event/lineup_model.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_image.dart';

/// Line-up de um evento: os artistas, em retratos quadrados.
///
/// Quadrado e não círculo — pela mesma razão do resto do app, a foto é um
/// recorte colado, não um selo. O nome vai em DM Mono, porque ali ele funciona
/// como legenda de identificação, não como título.
class LineupIndicator extends StatelessWidget {
  final List<LineupModel>? lineup;

  const LineupIndicator({super.key, this.lineup});

  @override
  Widget build(BuildContext context) {
    final artistas = lineup;
    if (artistas == null || artistas.isEmpty) return const SizedBox.shrink();

    return SizedBox(
      height: 116,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        physics: const BouncingScrollPhysics(),
        itemCount: artistas.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.md),
        itemBuilder: (context, index) {
          final artista = artistas[index];
          return SizedBox(
            width: 76,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(AppRadius.sm),
                    topRight: Radius.circular(AppRadius.sm),
                    bottomRight: Radius.circular(AppRadius.sm),
                  ),
                  child: SizedBox(
                    width: 76,
                    height: 82,
                    child: VibesterImage(
                      source: artista.url,
                      placeholderIcon: Icons.music_note_outlined,
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  artista.nome,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: context.typography.monoSmall.copyWith(
                    color: context.colors.textSecondary,
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
