import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/event/lineup_model.dart';
import 'package:mobile/theme/theme_extensions.dart';

class LineupIndicator extends StatelessWidget {
  final List<LineupModel>? lineup;

  const LineupIndicator({super.key, this.lineup});

  @override
  Widget build(BuildContext context) {
    if (lineup == null || lineup!.isEmpty) {
      return const SizedBox();
    }

    return SizedBox(
      height: 130,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: lineup!.length,
        separatorBuilder: (_, __) => const SizedBox(width: 16),
        itemBuilder: (context, index) {
          final artista = lineup![index];
          return Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                width: 83,
                height: 83,
                padding: EdgeInsets.all(3),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: context.colors.ambar, width: 2),
                ),
                child: ClipOval(
                  child: CachedNetworkImage(
                    imageUrl: artista.url,
                    fit: BoxFit.cover,
                    fadeInDuration: Duration.zero,
                    fadeOutDuration: Duration.zero,
                    errorWidget: (_, __, ___) => const Placeholder(),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              Text(
                artista.nome,
                style: GoogleFonts.inter(
                  color: context.colors.textPrimary,
                  fontSize: 13,
                ),
                overflow: TextOverflow.ellipsis,
              ),
            ],
          );
        },
      ),
    );
  }
}
