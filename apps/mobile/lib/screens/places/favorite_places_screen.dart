import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/place/place_card.dart';
import 'package:provider/provider.dart';

class FavoritePlacesScreen extends StatefulWidget {
  // Quando embutida nas sub-abas do perfil, o refresh já é feito pelo
  // RefreshIndicator externo (UserProfileScreen), evitando indicators aninhados.
  final bool showRefreshIndicator;

  const FavoritePlacesScreen({super.key, this.showRefreshIndicator = true});

  @override
  State<FavoritePlacesScreen> createState() => _FavoritePlacesScreenState();
}

class _FavoritePlacesScreenState extends State<FavoritePlacesScreen>
    with AutomaticKeepAliveClientMixin<FavoritePlacesScreen> {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);

    final List<PlaceModel> favorites = context
        .watch<PlaceListProvider>()
        .favorites;

    final list = favorites.isEmpty
        ? ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const SizedBox(height: 90),
              Center(
                child: SizedBox(
                  height: 200,
                  width: 200,
                  child: Opacity(
                    opacity: 0.8,
                    child: Image.asset('assets/img/mascote/lupa.png'),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  'Nenhum lugar marcado como favorito',
                  style: TextStyle(
                    color: context.colors.textDisabled,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          )
        : ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 16),
            itemCount: favorites.length + 1,
            itemBuilder: (context, index) {
              if (index == favorites.length) return SizedBox(height: 80);
              return PlaceCard(
                place: favorites[index],
                onTap: () {
                  Navigator.pushNamed(
                    context,
                    AppRoutes.placeDetail,
                    arguments: favorites[index].id,
                  );
                },
              );
            },
          );

    return Scaffold(
      backgroundColor: context.colors.noturno,
      body: widget.showRefreshIndicator
          ? RefreshIndicator(
              color: context.colors.ambar,
              onRefresh: () =>
                  context.read<PlaceListProvider>().fetchPlaces(force: true),
              child: list,
            )
          : list,
    );
  }
}
