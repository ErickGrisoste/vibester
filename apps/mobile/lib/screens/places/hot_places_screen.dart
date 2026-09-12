import 'package:diacritic/diacritic.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/place/place_tile.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/vibester_search_field.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:provider/provider.dart';

/// EM ALTA — estabelecimentos ordenados pelo movimento medido agora.
///
/// A ordenação é o conteúdo desta tela: antes ela mostrava a lista na ordem
/// em que a API devolveu e chamava isso de "Populares Agora". Aqui a lista é
/// de fato ordenada por `nivelMovimento` decrescente, e quem não tem leitura
/// de movimento vai para o fim — a promessa do título passa a ser verdade.
class HotPlacesScreen extends StatefulWidget {
  const HotPlacesScreen({super.key});

  @override
  State<HotPlacesScreen> createState() => _HotPlacesScreenState();
}

class _HotPlacesScreenState extends State<HotPlacesScreen> {
  final _searchController = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PlaceListProvider>().fetchPlaces();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<PlaceModel> _filter(List<PlaceModel> places) {
    final query = removeDiacritics(_query.trim().toLowerCase());
    final filtered = query.isEmpty
        ? [...places]
        : places
              .where(
                (p) =>
                    removeDiacritics(p.nome.toLowerCase()).contains(query) ||
                    removeDiacritics(p.categoria.toLowerCase()).contains(query),
              )
              .toList();

    filtered.sort((a, b) => b.nivelMovimento.compareTo(a.nivelMovimento));
    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final provider = context.watch<PlaceListProvider>();
    final places = _filter(provider.places);

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const ScreenHeader(
              title: 'Onde tem gente',
              eyebrow: 'MOVIMENTO AGORA',
              bottomSpacing: AppSpacing.md,
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screen,
                0,
                AppSpacing.screen,
                AppSpacing.md,
              ),
              child: VibesterSearchField(
                controller: _searchController,
                hint: 'Filtrar por nome ou categoria',
                onChanged: (value) => setState(() => _query = value),
              ),
            ),
            Expanded(
              child: RefreshIndicator(
                color: colors.ambar,
                backgroundColor: colors.surface,
                onRefresh: () =>
                    context.read<PlaceListProvider>().fetchPlaces(force: true),
                child: _buildList(context, provider, places),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildList(
    BuildContext context,
    PlaceListProvider provider,
    List<PlaceModel> places,
  ) {
    if (provider.isLoading && provider.places.isEmpty) {
      return ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.screen),
        itemCount: 6,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
        itemBuilder: (_, _) => const VibesterSkeleton(height: 72),
      );
    }

    if (provider.error != null && provider.places.isEmpty) {
      return ListView(
        children: [
          VibesterState.error(
            message: provider.error!,
            onAction: () =>
                context.read<PlaceListProvider>().fetchPlaces(force: true),
          ),
        ],
      );
    }

    if (places.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          VibesterState(
            headline: _query.isEmpty ? 'Nada por aqui' : 'Nada com esse nome',
            message: _query.isEmpty
                ? 'Nenhum estabelecimento cadastrado ainda.'
                : 'Tenta outro nome ou uma categoria.',
            icon: Icons.storefront_outlined,
          ),
        ],
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        0,
        AppSpacing.screen,
        AppSpacing.dockGap,
      ),
      itemCount: places.length,
      itemBuilder: (context, i) => StaggeredEntrance(
        index: i,
        child: PlaceTile(place: places[i]),
      ),
    );
  }
}
