import 'package:cached_network_image/cached_network_image.dart';
import 'package:share_plus/share_plus.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/screens/events/favorites_events_screen.dart';
import 'package:mobile/screens/highlights/property_highlights_screen.dart';
import 'package:mobile/screens/places/favorite_places_screen.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/divider.dart';
import 'package:mobile/utils/editable_text_field.dart';
import 'package:mobile/widgets/buttons/primary_button.dart';
import 'package:mobile/widgets/cards/users/profile_avatar.dart';
import 'package:provider/provider.dart';

class OtherUsersProfileScreen extends StatefulWidget {
  final String accountId;

  const OtherUsersProfileScreen({super.key, required this.accountId});

  @override
  State<OtherUsersProfileScreen> createState() =>
      _OtherUsersProfileScreenState();
}

class _OtherUsersProfileScreenState extends State<OtherUsersProfileScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final UserService _userService = UserService();
  final GlobalKey<PropertyHighlightsScreenState> _highlightsKey = GlobalKey();
  late Future<UserModel> _userFuture;

  bool _showAppBarAvatar = false;
  bool _isFollowing = false;
  bool _loadingFollow = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _userFuture = _loadUser();
  }

  Future<void> _onRefresh() async {
    setState(() {
      _userFuture = _loadUser();
    });

    await Future.wait([
      _userFuture,
      _highlightsKey.currentState?.refresh() ?? Future.value(),
    ]);
  }

  Future<UserModel> _loadUser() async {
    final currentUserId = context.read<UserProvider>().user?.accountId;

    final results = await Future.wait([
      _userService.getProfile(widget.accountId),
      currentUserId != null
          ? _userService.isFollowing(
              followerId: currentUserId,
              followingId: widget.accountId,
            )
          : Future.value(false),
    ]);

    final profileData = results[0] as Map<String, dynamic>;
    final isFollowing = results[1] as bool;

    if (mounted) {
      setState(() => _isFollowing = isFollowing);
    }

    return UserModel.fromProfileJson(profileData, accountId: widget.accountId);
  }

  Future<void> _alternarSeguir(UserModel otherUser) async {
    final currentUserId = context.read<UserProvider>().user?.accountId;
    if (currentUserId == null || _loadingFollow) return;

    setState(() => _loadingFollow = true);

    try {
      if (_isFollowing) {
        await _userService.unfollowUser(
          followerId: currentUserId,
          followingId: widget.accountId,
        );
        setState(() {
          _isFollowing = false;
          otherUser.seguidores -= 1;
        });
      } else {
        await _userService.followUser(
          followerId: currentUserId,
          followingId: widget.accountId,
        );
        setState(() {
          _isFollowing = true;
          otherUser.seguidores += 1;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) setState(() => _loadingFollow = false);
    }
  }

  Future<void> _shareProfile(UserModel otherUser) async {
    try {
      final shareUrl = await _userService.generateShareLink(widget.accountId);
      await Share.share(
        'Confira o perfil de ${otherUser.nome} no Vibester: $shareUrl',
        subject: 'Perfil no Vibester',
      );
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<UserModel>(
      future: _userFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return Scaffold(
            backgroundColor: context.colors.noturno,
            body: Center(
              child: CircularProgressIndicator(color: context.colors.brasa),
            ),
          );
        }

        if (snapshot.hasError) {
          return Scaffold(
            backgroundColor: context.colors.noturno,
            appBar: AppBar(
              backgroundColor: context.colors.navy,
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

        return _buildProfile(context, snapshot.data!);
      },
    );
  }

  Widget _buildProfile(BuildContext context, UserModel otherUser) {
    return Scaffold(
      appBar: AppBar(
        actions: const [SizedBox(width: 48)],
        backgroundColor: context.colors.navy,
        foregroundColor: context.colors.textPrimary,
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
        title: Center(
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              AnimatedSize(
                duration: const Duration(milliseconds: 300),
                curve: Curves.easeInOut,
                child: _showAppBarAvatar
                    ? Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: CircleAvatar(
                          radius: 16,
                          backgroundImage: CachedNetworkImageProvider(
                            otherUser.fotoPerfil,
                          ),
                        ),
                      )
                    : const SizedBox.shrink(),
              ),
              Text(
                otherUser.nomeUsuario,
                style: GoogleFonts.inter(
                  color: context.colors.textPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
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
                      child: ProfileAvatar(
                        imageUrl: otherUser.fotoPerfil,
                        editable: false,
                      ),
                    ),

                    SizedBox(height: 12),

                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 24),
                      child: FittedBox(
                        fit: BoxFit.scaleDown,
                        child: Text(
                          otherUser.nome,
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
                          label: otherUser.nomeUsuario,
                          height: 30,
                          width: double.infinity,
                        ),
                      ),
                    ),

                    SizedBox(height: 20),

                    Text(
                      otherUser.bio,
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
                              otherUser.seguidores.toString(),
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
                              otherUser.seguindo.toString(),
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
                              otherUser.eventosVisitados.toString(),
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
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        PrimaryButton(
                          label: _isFollowing ? "Seguindo" : "Seguir",
                          state: _isFollowing
                              ? ButtonState.success
                              : ButtonState.idle,
                          onPressed: () {
                            if (_loadingFollow) return;
                            _alternarSeguir(otherUser);
                          },
                        ),
                        SizedBox(width: 14),
                        Material(
                          color: Colors.transparent,
                          shape: const CircleBorder(),
                          child: InkWell(
                            customBorder: const CircleBorder(),
                            onTap: () => _shareProfile(otherUser),
                            child: Container(
                              height: 40,
                              width: 40,
                              decoration: BoxDecoration(
                                border: Border.fromBorderSide(
                                  BorderSide(
                                    color: context.colors.textPrimary,
                                    width: 1,
                                  ),
                                ),
                                shape: BoxShape.circle,
                              ),
                              child: Icon(
                                Icons.ios_share,
                                color: context.colors.textPrimary,
                                size: 18,
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
                          accountId: otherUser.accountId ?? widget.accountId,
                        ),
                      ),
                      Center(child: FavoritePlacesScreen()),
                      Center(child: FavoritesEventsScreen()),
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
