import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/place/place_card.dart';
import 'package:provider/provider.dart';

class FavoritesScreen extends StatefulWidget {
  const FavoritesScreen({super.key});

  @override
  State<FavoritesScreen> createState() => _FavoritesScreenState();
}

class _FavoritesScreenState extends State<FavoritesScreen> {
  @override
  Widget build(BuildContext context) {
    final List<PlaceModel> favorites = context
        .watch<PlaceListProvider>()
        .favorites;
    return ColoredBox(
      color: context.colors.noturno,
      child: ListView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.symmetric(vertical: 16),
        itemCount: favorites.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 0),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text(
                        'Seus lugares favoritos',
                        style: TextStyle(
                          color: context.colors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Text(
                        'Os lugares que você ama acompanhar de perto.',
                        style: TextStyle(
                          color: context.colors.textDisabled,
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }

          return PlaceCard(
            place: favorites[index - 1],
            onTap: () {
              Navigator.pushNamed(
                context,
                AppRoutes.placeDetail,
                arguments: favorites[index - 1].id,
              );
            },
          );
        },
      ),
    );
  }
}
