import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/indicators/category_indicator.dart';
import 'package:mobile/widgets/indicators/movement_indicator.dart';
import 'package:mobile/widgets/indicators/price_indicator.dart';

class PlaceCardForFavorites extends StatelessWidget {
  final PlaceModel place;
  final VoidCallback? onTap;

  const PlaceCardForFavorites({super.key, required this.place, this.onTap});

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
              padding: EdgeInsets.symmetric(horizontal: 16, vertical: 25),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Container(
                    width: 86,
                    height: 86,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: context.colors.ambar, width: 2),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(3),
                      child: Container(
                        width: 80,
                        height: 80,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: context.colors.noturno,
                            width: 0,
                          ),
                        ),
                        child: ClipOval(child: Placeholder()),
                      ),
                    ),
                  ),
                  SizedBox(width: 12),
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
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
                        ),
                        SizedBox(height: 2),
                        Row(
                          children: [
                            Icon(Icons.star, color: Colors.yellow, size: 16),
                            SizedBox(width: 4),
                            Text(
                              '${place.avaliacao}',
                              style: TextStyle(color: Colors.yellow),
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
              child: Row(
                children: [
                  CategoryIndicator(categoria: place.categoria),
                  SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.all(4),
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: context.colors.ambar, width: 1),
                    ),
                    child: Icon(
                      Icons.star_outline,
                      color: context.colors.ambar,
                      size: 16,
                    ),
                  ),
                ],
              ),
            ),
            Positioned(
              bottom: 10,
              right: 10,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(color: context.colors.ambar, width: 1),
                ),
                child: Icon(
                  Icons.arrow_forward_ios,
                  color: context.colors.ambar,
                  size: 16,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
