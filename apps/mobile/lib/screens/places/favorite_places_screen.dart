import 'package:flutter/material.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/place/place_tile.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:provider/provider.dart';

/// Estabelecimentos salvos.
///
/// Como [FavoritesEventsScreen], continua existindo para a rota direta e para
/// uso embutido; a experiência principal de "o que eu salvei" é `SavedScreen`.
class FavoritePlacesScreen extends StatefulWidget {
  final bool showRefreshIndicator;

  const FavoritePlacesScreen({super.key, this.showRefreshIndicator = true});

  @override
  State<FavoritePlacesScreen> createState() => _FavoritePlacesScreenState();
}

class _FavoritePlacesScreenState extends State<FavoritePlacesScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PlaceListProvider>().fetchPlaces();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final places = context.watch<PlaceListProvider>().favorites;

    final list = places.isEmpty
        ? ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: const [
              VibesterState(
                headline: 'Nada salvo ainda',
                message:
                    'Salve os lugares que você quer acompanhar e veja o '
                    'movimento deles direto daqui.',
                icon: Icons.bookmark_border_rounded,
              ),
            ],
          )
        : ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.screen,
              AppSpacing.lg,
              AppSpacing.screen,
              AppSpacing.dockGap,
            ),
            itemCount: places.length,
            itemBuilder: (context, i) => StaggeredEntrance(
              index: i,
              child: PlaceTile(place: places[i], hero: false),
            ),
          );

    if (!widget.showRefreshIndicator) return list;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const ScreenHeader(
              title: 'Seus lugares',
              eyebrow: 'SALVOS POR VOCÊ',
            ),
            Expanded(
              child: RefreshIndicator(
                color: colors.ambar,
                backgroundColor: colors.surface,
                onRefresh: () =>
                    context.read<PlaceListProvider>().fetchPlaces(force: true),
                child: list,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
