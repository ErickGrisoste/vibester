import 'package:diacritic/diacritic.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/place/place_card.dart';
import 'package:mobile/utils/search_bar.dart';
import 'package:provider/provider.dart';

class HotPlacesScreen extends StatefulWidget {
  const HotPlacesScreen({super.key});

  @override
  State<HotPlacesScreen> createState() => _HotPlacesScreenState();
}

class _HotPlacesScreenState extends State<HotPlacesScreen> {
  final TextEditingController pesquisaController = TextEditingController();
  List<PlaceModel> listaFiltrada = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PlaceListProvider>().fetchPlaces();
    });
  }

  List<PlaceModel> filtrarPlaces(List<PlaceModel> places) {
    final query = removeDiacritics(pesquisaController.text.toUpperCase());
    if (query.isEmpty) return places;
    return places
        .where(
          (place) =>
              removeDiacritics(place.nome.toUpperCase()).contains(query) ||
              removeDiacritics(place.categoria.toUpperCase()).contains(query),
        )
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PlaceListProvider>();
    final places = context.watch<PlaceListProvider>().places;
    final listaFiltrada = filtrarPlaces(places);

    if (provider.isLoading && places.isEmpty) {
      return Scaffold(
        backgroundColor: context.colors.noturno,
        body: Center(
          child: CircularProgressIndicator(color: context.colors.ambar),
        ),
      );
    }

    return Scaffold(
      backgroundColor: context.colors.noturno,
      body: RefreshIndicator(
        color: context.colors.ambar,
        onRefresh: () =>
            context.read<PlaceListProvider>().fetchPlaces(force: true),
        child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(0, 16, 0, 80),
          itemCount: listaFiltrada.isEmpty ? 2 : listaFiltrada.length + 1,
          itemBuilder: (context, index) {
            if (index == 0) {
              return Padding(
                padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Populares Agora',
                      style: TextStyle(
                        color: context.colors.textPrimary,
                        fontSize: 28,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text.rich(
                      TextSpan(
                        text: 'Os locais mais movimentados da cidade ',
                        style: TextStyle(
                          color: context.colors.textMuted,
                          fontSize: 14,
                        ),
                        children: [
                          TextSpan(
                            text: 'ao vivo!',
                            style: TextStyle(
                              color: context.colors.ambar,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    CustomSearchBar(
                      controller: pesquisaController,
                      onChanged: () {
                        setState(() {});
                      },
                    ),
                  ],
                ),
              );
            }

            if (listaFiltrada.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 90),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    SizedBox(
                      height: 200,
                      width: 200,
                      child: Image.asset('assets/img/mascote/lupa.png'),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Nenhum lugar encontrado',
                      style: TextStyle(
                        color: context.colors.textDisabled,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Tente buscar por outro nome ou categoria',
                      style: TextStyle(
                        color: context.colors.textDisabled,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
              );
            }

            return PlaceCard(
              place: listaFiltrada[index - 1],
              onTap: () {
                Navigator.pushNamed(
                  context,
                  AppRoutes.placeDetail,
                  arguments: listaFiltrada[index - 1].id,
                );
              },
            );
          },
        ),
      ),
    );
  }
}
