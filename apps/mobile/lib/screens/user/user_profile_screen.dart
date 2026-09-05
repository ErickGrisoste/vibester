import 'package:cached_network_image/cached_network_image.dart';
import 'package:share_plus/share_plus.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:provider/provider.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/screens/events/favorites_events_screen.dart';
import 'package:mobile/screens/highlights/property_highlights_screen.dart';
import 'package:mobile/screens/places/favorite_places_screen.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/divider.dart';
import 'package:mobile/utils/editable_text_field.dart';
import 'package:mobile/widgets/cards/users/profile_avatar.dart';

class UserProfileScreen extends StatefulWidget {
  const UserProfileScreen({super.key});

  @override
  State<UserProfileScreen> createState() => UserProfileScreenState();
}

class UserProfileScreenState extends State<UserProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final UserService _userService = UserService();
  final GlobalKey<PropertyHighlightsScreenState> _highlightsKey = GlobalKey();

  bool _showAppBarAvatar = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  // Chamado ao entrar na aba de perfil pelo navbar, pra manter os dados em
  // dia mesmo com as telas do IndexedStack sendo montadas só uma vez.
  Future<void> refreshProfileData() => _fetchProfile();

  Future<void> _fetchProfile() async {
    final user = context.read<UserProvider>().user;
    final accountId = user?.accountId;
    if (accountId == null) return;

    try {
      final profileData = await _userService.getProfile(accountId);
      final usuarioAtualizado = UserModel.fromProfileJson(
        profileData,
        accountId: accountId,
        token: user?.token,
      );

      if (mounted) {
        context.read<UserProvider>().setUser(usuarioAtualizado);
      }
    } catch (_) {
      // Mantém os dados atuais em tela caso a atualização falhe
    }
  }

  Future<void> _shareProfile() async {
    final accountId = context.read<UserProvider>().user?.accountId;
    if (accountId == null) return;

    try {
      final shareUrl = await _userService.generateShareLink(accountId);
      await Share.share(
        'Confira meu perfil no Vibester: $shareUrl',
        subject: 'Meu perfil no Vibester',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  Future<void> _onRefresh() async {
    await _fetchProfile();

    switch (_tabController.index) {
      case 0:
        await _highlightsKey.currentState?.refresh();
        break;
      case 1:
        await context.read<PlaceListProvider>().fetchPlaces(force: true);
        break;
      case 2:
        await context.read<EventsListProvider>().fetchEvents(force: true);
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = context.watch<UserProvider>().user;

    if (user == null) {
      return Scaffold(
        backgroundColor: context.colors.noturno,
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    return Scaffold(
      appBar: AppBar(
        automaticallyImplyLeading: false,
        backgroundColor: context.colors.navy,
        scrolledUnderElevation: 0,
        surfaceTintColor: Colors.transparent,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            color: context.colors.navy,
            boxShadow: [
              BoxShadow(
                color: context.colors.border.withOpacity(0.1),
                blurRadius: 10,
                offset: const Offset(0, 3),
              ),
            ],
          ),
        ),
        title: SizedBox(
          width: double.infinity,
          child: Stack(
            alignment: Alignment.center,
            children: [
              AnimatedOpacity(
                duration: Duration(milliseconds: 300),
                opacity: _showAppBarAvatar ? 1.0 : 0.0,
                child: AnimatedSlide(
                  duration: Duration(milliseconds: 300),
                  offset: _showAppBarAvatar ? Offset(-1.2, 0) : Offset(-1.2, 0),
                  child: CircleAvatar(
                    radius: 16,
                    backgroundImage: CachedNetworkImageProvider(
                      user.fotoPerfil,
                    ),
                  ),
                ),
              ),
              AnimatedSlide(
                duration: Duration(milliseconds: 300),
                offset: _showAppBarAvatar ? Offset(0.19, 0) : Offset(0, 0),
                child: Text(
                  user.nomeUsuario,
                  style: GoogleFonts.inter(
                    color: context.colors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 16,
                  ),
                ),
              ),
            ],
          ),
        ),
        centerTitle: true,
      ),
      backgroundColor: context.colors.noturno,
      body: NotificationListener<ScrollNotification>(
        onNotification: (notification) {
          if (notification.depth == 0 &&
              notification is ScrollUpdateNotification) {
            setState(() {
              _showAppBarAvatar = notification.metrics.pixels > 200;
            });
          }
          return false;
        },
        child: RefreshIndicator(
          color: context.colors.ambar,
          backgroundColor: context.colors.navy,
          onRefresh: _onRefresh,
          child: NestedScrollView(
            headerSliverBuilder: (context, innerBoxIsScrolled) => [
              SliverToBoxAdapter(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    Padding(
                      padding: EdgeInsets.only(top: 30.0),
                      child: ProfileAvatar(imageUrl: user.fotoPerfil),
                    ),

                    SizedBox(height: 12),

                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          '${user.nome}',
                          style: GoogleFonts.inter(
                            color: context.colors.textPrimary,
                            fontSize: 35,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),

                    SizedBox(height: 12),

                    IntrinsicWidth(
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(
                          minWidth: 150,
                          maxWidth: 280,
                        ),
                        child: EditableTextField(
                          label: user.nomeUsuario,
                          height: 30,
                          width: double.infinity,
                        ),
                      ),
                    ),

                    SizedBox(height: 20),

                    Text(
                      user.bio,
                      style: GoogleFonts.inter(
                        color: context.colors.textSecondary,
                        fontWeight: FontWeight.bold,
                      ),
                    ),

                    SizedBox(height: 12),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Column(
                          children: [
                            Text(
                              user.seguidores.toString(),
                              style: GoogleFonts.inter(
                                color: context.colors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                            Text(
                              'SEGUIDORES',
                              style: GoogleFonts.inter(
                                color: context.colors.textSecondary,
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),

                        MyDivider(height: 50, width: 1),

                        Column(
                          children: [
                            Text(
                              user.seguindo.toString(),
                              style: GoogleFonts.inter(
                                color: context.colors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                            Text(
                              'SEGUINDO',
                              style: GoogleFonts.inter(
                                color: context.colors.textSecondary,
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),

                        MyDivider(height: 50, width: 1),

                        Column(
                          children: [
                            Text(
                              user.eventosVisitados.toString(),
                              style: GoogleFonts.inter(
                                color: context.colors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 18,
                              ),
                            ),
                            Text(
                              'EVENTOS',
                              style: GoogleFonts.inter(
                                color: context.colors.textSecondary,
                                fontWeight: FontWeight.bold,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),

                    SizedBox(height: 16),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Material(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(50),
                          child: InkWell(
                            onTap: () {
                              Navigator.pushNamed(context, AppRoutes.settings);
                            },
                            borderRadius: BorderRadius.circular(50),
                            child: Container(
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: context.colors.textPrimary,
                                  width: 1,
                                ),
                                borderRadius: BorderRadius.circular(50),
                              ),
                              height: 30,
                              width: 150,
                              child: Center(
                                child: Text(
                                  'Configurações',
                                  style: GoogleFonts.inter(
                                    color: context.colors.textPrimary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),

                        SizedBox(width: 14),

                        Material(
                          color: Colors.transparent,
                          borderRadius: BorderRadius.circular(50),
                          child: InkWell(
                            onTap: _shareProfile,
                            borderRadius: BorderRadius.circular(50),
                            child: Container(
                              decoration: BoxDecoration(
                                border: Border.all(
                                  color: context.colors.textPrimary,
                                  width: 1,
                                ),
                                borderRadius: BorderRadius.all(
                                  Radius.circular(50),
                                ),
                              ),
                              height: 30,
                              width: 150,
                              child: Center(
                                child: Text(
                                  'Compartilhar perfil',
                                  style: GoogleFonts.inter(
                                    color: context.colors.textPrimary,
                                    fontWeight: FontWeight.bold,
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),

                    SizedBox(height: 16),
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
                    indicatorColor: context.colors.brasa,
                    indicatorPadding: EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    labelPadding: EdgeInsets.all(10),
                    labelStyle: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                    tabs: [
                      Tab(text: 'FOTOS'),
                      Tab(text: 'FAVORITOS'),
                      Tab(text: 'CHECK-IN'),
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
                      Center(
                        child: PropertyHighlightsScreen(
                          key: _highlightsKey,
                          // Precisa do ? pq usuario pede ser null, inclusive começa como null, assim não estora erro
                          accountId: user?.accountId ?? '',
                        ),
                      ),
                      Center(
                        child: FavoritePlacesScreen(
                          showRefreshIndicator: false,
                        ),
                      ),
                      Center(
                        child: FavoritesEventsScreen(
                          showRefreshIndicator: false,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
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
