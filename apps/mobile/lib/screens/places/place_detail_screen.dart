import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/screens/events/event_list_screen.dart';
import 'package:mobile/screens/highlights/property_highlights_screen.dart';
import 'package:mobile/screens/places/place_reviews_screen.dart';
import 'package:mobile/service/places/place_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/indicators/category_indicator.dart';
import 'package:mobile/utils/divider.dart';
import 'package:mobile/widgets/indicators/place_stats_bar.dart';
import 'package:mobile/widgets/buttons/primary_button.dart';
import 'package:provider/provider.dart';

class PlaceDetailScreen extends StatefulWidget {
  final String placeId;

  const PlaceDetailScreen({super.key, required this.placeId});

  @override
  State<PlaceDetailScreen> createState() => _PlaceDetailScreenState();
}

class _PlaceDetailScreenState extends State<PlaceDetailScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  late Future<PlaceModel> _placeFuture;
  final PlaceService _placeService = PlaceService();

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _placeFuture = _loadPlace();
  }

  Future<PlaceModel> _loadPlace() async {
    return _placeService.getPlaceById(widget.placeId);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<PlaceModel>(
      future: _placeFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Scaffold(
            backgroundColor: context.colors.noturno,
            body: Center(
              child: CircularProgressIndicator(color: context.colors.ambar),
            ),
          );
        }

        if (snapshot.hasError) {
          return Scaffold(
            backgroundColor: context.colors.noturno,
            appBar: AppBar(
              backgroundColor: context.colors.noturno,
              foregroundColor: context.colors.textPrimary,
            ),
            body: Center(
              child: Text(
                snapshot.error.toString(),
                style: TextStyle(color: context.colors.textMuted),
                textAlign: TextAlign.center,
              ),
            ),
          );
        }

        final place = snapshot.data!;
        final provider = Provider.of<PlaceListProvider>(context);

        return Scaffold(
          backgroundColor: context.colors.noturno,
          appBar: AppBar(
            title: Text(
              place.nome,
              style: GoogleFonts.inter(fontWeight: FontWeight.bold),
            ),
            backgroundColor: context.colors.noturno,
            foregroundColor: context.colors.textPrimary,
          ),
          body: _buildContent(context, place, provider),
        );
      },
    );
  }

  Widget _buildContent(
    BuildContext context,
    PlaceModel place,
    PlaceListProvider provider,
  ) {
    return NestedScrollView(
      headerSliverBuilder: (context, innerBoxIsScrolled) => [
        SliverToBoxAdapter(
          child: Column(
            children: [
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.bottomCenter,
                children: [
                  SizedBox(
                    height: 250,
                    width: double.infinity,
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        CachedNetworkImage(
                          imageUrl:
                              'https://media.gettyimages.com/id/1266107863/pt/foto/dj-playing-and-mixing-music-at-party.jpg?s=2048x2048&w=gi&k=20&c=Tmm9GWCaVF_gTB4becCcYTaNJEZepQG8VoxLAunIDKA=',
                          fit: BoxFit.cover,
                          fadeInDuration: Duration.zero,
                          fadeOutDuration: Duration.zero,
                          placeholder: (_, _) =>
                              const Center(child: CircularProgressIndicator()),
                          errorWidget: (_, _, _) => const Icon(Icons.error),
                        ),
                        Container(
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              begin: Alignment.topCenter,
                              end: Alignment.bottomCenter,
                              colors: [
                                Colors.transparent,
                                context.colors.noturno.withOpacity(0.3),
                                context.colors.noturno.withOpacity(0.7),
                                context.colors.noturno,
                              ],
                              stops: const [0.0, 0.4, 0.7, 1.0],
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  Positioned(
                    bottom: -25,
                    child: SizedBox(
                      width: 100,
                      height: 100,
                      child: Container(
                        decoration: BoxDecoration(
                          boxShadow: [
                            BoxShadow(
                              color: context.colors.ambar.withOpacity(0.6),
                              blurRadius: 10,
                              offset: const Offset(0, 1),
                              spreadRadius: 3,
                            ),
                          ],
                          borderRadius: BorderRadius.circular(50),
                        ),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(50),
                          child: SizedBox(
                            height: 80,
                            width: 80,
                            child: CachedNetworkImage(
                              imageUrl: place.profileImage,
                              fit: BoxFit.cover,
                              fadeInDuration: Duration.zero,
                              fadeOutDuration: Duration.zero,
                              placeholder: (_, _) => const Center(
                                child: CircularProgressIndicator(),
                              ),
                              errorWidget: (_, _, _) => const Icon(Icons.error),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
              Text(
                place.nome.toUpperCase(),
                style: TextStyle(
                  color: context.colors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 28,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 10),
              CategoryIndicator(categoria: place.categoria.toUpperCase()),
              const SizedBox(height: 10),
              SizedBox(
                width: 350,
                child: Text(
                  place.bio,
                  style: TextStyle(color: context.colors.textMuted),
                  textAlign: TextAlign.center,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.location_on, color: context.colors.brasa),
                  Text(
                    place.endereco,
                    style: TextStyle(color: context.colors.textMuted),
                  ),
                ],
              ),
              PlaceStatsBar(seguidores: '12k', avaliacao: place.avaliacao),
              PrimaryButton(
                label: 'Seguir',
                state: place.isFavorite
                    ? ButtonState.success
                    : ButtonState.idle,
                onPressed: () {
                  provider.toggleFavorite(place.nome);
                },
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
        SliverPersistentHeader(
          pinned: true,
          delegate: _StickyTabBarDelegate(
            TabBar(
              controller: _tabController,
              unselectedLabelColor: context.colors.textMuted,
              labelColor: context.colors.textPrimary,
              dividerColor: Colors.transparent,
              indicatorColor: context.colors.ambar,
              indicatorPadding: EdgeInsetsGeometry.symmetric(
                horizontal: 10,
                vertical: 6,
              ),
              labelPadding: EdgeInsets.all(10),
              labelStyle: GoogleFonts.inter(
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
              tabs: [
                Tab(text: 'DESTAQUES'),
                Tab(text: 'EVENTOS'),
                Tab(text: 'AVALIAÇÕES'),
              ],
            ),
            color: context.colors.noturno,
          ),
        ),
      ],
      body: Column(
        children: [
          Padding(
            padding: EdgeInsets.symmetric(vertical: 3.0),
            child: MyDivider(height: 1, width: double.infinity),
          ),
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                PropertyHighlightsScreen(placeId: place.id),
                EventListScreen(),
                PlaceReviewsScreen(place: place),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _StickyTabBarDelegate extends SliverPersistentHeaderDelegate {
  final TabBar tabBar;
  final Color color;

  const _StickyTabBarDelegate(this.tabBar, {required this.color});

  @override
  double get minExtent => tabBar.preferredSize.height;

  @override
  double get maxExtent => tabBar.preferredSize.height;

  @override
  Widget build(
    BuildContext context,
    double shrinkOffset,
    bool overlapsContent,
  ) {
    return Container(color: color, child: tabBar);
  }

  @override
  bool shouldRebuild(_StickyTabBarDelegate oldDelegate) =>
      tabBar != oldDelegate.tabBar || color != oldDelegate.color;
}
