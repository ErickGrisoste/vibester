import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/indicators/category_indicator.dart';
import 'package:mobile/widgets/indicators/movement_indicator.dart';
import 'package:mobile/widgets/indicators/price_indicator.dart';

class PlaceCard extends StatelessWidget {
  final PlaceModel place;
  final VoidCallback? onTap;

  const PlaceCard({super.key, required this.place, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Card(
        color: context.colors.noturno,
        margin: EdgeInsets.symmetric(horizontal: 8, vertical: 8),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: context.colors.grey.withAlpha(80), width: 1),
        ),
        child: Stack(
          children: [
            Padding(
              padding: EdgeInsets.all(32),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    decoration: BoxDecoration(
                      boxShadow: [
                        BoxShadow(
                          color: context.colors.ambar.withOpacity(0.6),
                          blurRadius: 10,
                          offset: const Offset(0, 1),
                          spreadRadius: 2,
                        ),
                      ],
                      borderRadius: BorderRadius.circular(25),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(25),
                      child: SizedBox(
                        height: 80,
                        width: 80,
                        child: CachedNetworkImage(
                          imageUrl: place.profileImage,
                          fit: BoxFit.cover,
                          fadeInDuration: Duration.zero,
                          fadeOutDuration: Duration.zero,
                          placeholder: (_, _) =>
                              const Center(child: CircularProgressIndicator()),
                          errorWidget: (_, _, _) => const Icon(Icons.error),
                        ),
                      ),
                    ),
                  ),
                  SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          place.nome,
                          style: TextStyle(
                            color: context.colors.textPrimary,
                            fontSize: 18,
                            fontWeight: FontWeight.bold,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        SizedBox(height: 2),
                        Row(
                          children: [
                            Icon(Icons.star, color: Colors.yellow, size: 16),
                            SizedBox(width: 4),
                            Text(
                              '${place.avaliacao}',
                              style: TextStyle(color: context.colors.textMuted),
                            ),
                            SizedBox(width: 4),
                            Icon(
                              Icons.circle,
                              color: context.colors.border,
                              size: 6,
                            ),
                            SizedBox(width: 4),
                            PriceIndicator(nivel: place.nivelPrecoMedio),
                          ],
                        ),
                        Text(
                          'Movimento',
                          style: TextStyle(
                            color: context.colors.textSecondary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        SizedBox(height: 3),
                        MovimentoIndicator(nivel: place.nivelMovimento),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              top: 10,
              right: 10,
              child: CategoryIndicator(categoria: place.categoria),
            ),
          ],
        ),
      ),
    );
  }
}
