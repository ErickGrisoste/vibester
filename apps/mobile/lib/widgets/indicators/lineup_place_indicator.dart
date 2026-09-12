import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/indicators/price_indicator.dart';
import 'package:provider/provider.dart';

class LineupPlaceIndicator extends StatelessWidget {
  const LineupPlaceIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    final placesProvider = context.watch<PlaceListProvider>();
    final places = placesProvider.places;

    if (placesProvider.isLoading && places.isEmpty) {
      return SizedBox(
        height: 160,
        child: Center(
          child: CircularProgressIndicator(color: context.colors.ambar),
        ),
      );
    }

    if (places.isEmpty) {
      return const SizedBox();
    }

    return SizedBox(
      height: 160,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: places.length,
        separatorBuilder: (_, _) => const SizedBox(width: 16),
        itemBuilder: (context, index) {
          final place = places[index];

          return GestureDetector(
            onTap: () {
              Navigator.pushNamed(
                context,
                AppRoutes.placeDetail,
                arguments: place.id,
              );
            },
            child: SizedBox(
              width: 86,
              child: Column(
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
                        child: ClipOval(
                          child: place.profileImage.isEmpty
                              ? Container(
                                  color: Colors.white12,
                                  child: Icon(
                                    Icons.storefront,
                                    color: context.colors.textDisabled,
                                  ),
                                )
                              : CachedNetworkImage(
                                  imageUrl: place.profileImage,
                                  fit: BoxFit.cover,
                                  fadeInDuration: Duration.zero,
                                  fadeOutDuration: Duration.zero,
                                  errorWidget: (_, _, _) => Container(
                                    color: Colors.white12,
                                    child: Icon(
                                      Icons.storefront,
                                      color: context.colors.textDisabled,
                                    ),
                                  ),
                                ),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 15),
                  Text(
                    place.nome,
                    textAlign: TextAlign.center,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: GoogleFonts.inter(
                      color: context.colors.textPrimary,
                      fontWeight: FontWeight.bold,
                      fontSize: 12,
                    ),
                  ),

                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.star_border,
                        color: context.colors.brasa,
                        size: 12,
                      ),
                      SizedBox(width: 6),
                      Text(
                        '${place.avaliacao}',
                        style: TextStyle(
                          color: context.colors.textMuted,
                          fontSize: 11,
                        ),
                      ),
                      SizedBox(width: 7),
                      Icon(Icons.circle, color: context.colors.border, size: 4),
                      SizedBox(width: 7),
                      PriceIndicator(nivel: place.nivelPrecoMedio),
                    ],
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
