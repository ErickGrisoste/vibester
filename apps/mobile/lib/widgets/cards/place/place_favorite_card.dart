import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/indicators/category_indicator.dart';

class PlaceFavoriteCard extends StatelessWidget {
  final PlaceModel place;
  final VoidCallback? onTap;

  const PlaceFavoriteCard({super.key, required this.place, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Card(
        color: context.colors.navy,
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
                  ClipRRect(
                    borderRadius: BorderRadius.circular(50),
                    child: SizedBox(
                      height: 70,
                      width: 70,
                      child: Container(color: Colors.white),
                    ),
                  ),
                  SizedBox(width: 12),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        textAlign: TextAlign.center,
                        place.nome,
                        style: TextStyle(
                          color: context.colors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
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
