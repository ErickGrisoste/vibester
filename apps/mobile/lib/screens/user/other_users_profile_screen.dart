import 'package:flutter/material.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/screens/highlights/property_highlights_screen.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/utils/username.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

/// Perfil de outra pessoa.
///
/// Mesma composição do perfil próprio (retrato colado, nome grande, números em
/// DM Mono, grade de fotos), com a ação trocada: onde o seu perfil tem "Seus
/// rolês", aqui fica **Seguir** — a única decisão que essa tela pede.
///
/// As abas de "favoritos" e "check-in" saíram: elas mostravam,
/// para qualquer visitante, os favoritos e os check-ins do **usuário logado**,
/// não os da pessoa sendo visitada (`FavoritePlacesScreen` e
/// `FavoritesEventsScreen` leem os providers da sessão atual). Além de não ser
/// o conteúdo prometido pela aba, é informação de outra pessoa aparecendo no
/// perfil errado.
class OtherUsersProfileScreen extends StatefulWidget {
  final String accountId;

  const OtherUsersProfileScreen({super.key, required this.accountId});

  @override
  State<OtherUsersProfileScreen> createState() =>
      _OtherUsersProfileScreenState();
}

class _OtherUsersProfileScreenState extends State<OtherUsersProfileScreen> {
  final UserService _userService = UserService();
  final GlobalKey<PropertyHighlightsScreenState> _highlightsKey = GlobalKey();

  late Future<UserModel> _userFuture = _loadUser();

  bool _isFollowing = false;
  bool _loadingFollow = false;

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

    if (mounted) setState(() => _isFollowing = isFollowing);

    return UserModel.fromProfileJson(profileData, accountId: widget.accountId);
  }

  Future<void> _onRefresh() async {
    setState(() => _userFuture = _loadUser());
    await Future.wait([
      _userFuture,
      _highlightsKey.currentState?.refresh() ?? Future.value(),
    ]);
  }

  /// Seguir/deixar de seguir com atualização otimista do contador: o número
  /// muda junto com o botão e só volta atrás se a chamada falhar.
  Future<void> _alternarSeguir(UserModel otherUser) async {
    final currentUserId = context.read<UserProvider>().user?.accountId;
    if (currentUserId == null || _loadingFollow) return;

    final seguiaAntes = _isFollowing;
    setState(() {
      _loadingFollow = true;
      _isFollowing = !seguiaAntes;
      otherUser.seguidores += seguiaAntes ? -1 : 1;
    });

    try {
      if (seguiaAntes) {
        await _userService.unfollowUser(
          followerId: currentUserId,
          followingId: widget.accountId,
        );
      } else {
        await _userService.followUser(
          followerId: currentUserId,
          followingId: widget.accountId,
        );
      }
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _isFollowing = seguiaAntes;
        otherUser.seguidores += seguiaAntes ? 1 : -1;
      });
      debugPrint('Falha ao seguir/desseguir: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não deu certo agora. Tenta de novo.')),
      );
    } finally {
      if (mounted) setState(() => _loadingFollow = false);
    }
  }

  Future<void> _shareProfile() async {
    try {
      final shareUrl = await _userService.generateShareLink(widget.accountId);
      await SharePlus.instance.share(
        ShareParams(text: 'Olha esse perfil no Vibester: $shareUrl'),
      );
    } catch (e) {
      if (!mounted) return;
      debugPrint('Falha ao compartilhar perfil: $e');
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível gerar o link agora')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: FutureBuilder<UserModel>(
        future: _userFuture,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const SafeArea(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.screen),
                child: VibesterSkeletonLines(lines: 4, spacing: AppSpacing.lg),
              ),
            );
          }

          if (snapshot.hasError || !snapshot.hasData) {
            return SafeArea(
              child: VibesterState.error(
                message:
                    'Não foi possível carregar esse perfil. Confere sua '
                    'conexão e tenta de novo.',
                onAction: () => setState(() => _userFuture = _loadUser()),
              ),
            );
          }

          final user = snapshot.data!;

          return RefreshIndicator(
            color: colors.ambar,
            backgroundColor: colors.surface,
            onRefresh: _onRefresh,
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: _OtherIdentity(
                    user: user,
                    isFollowing: _isFollowing,
                    loading: _loadingFollow,
                    onFollow: () => _alternarSeguir(user),
                    onShare: _shareProfile,
                  ),
                ),
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(
                      AppSpacing.screen,
                      AppSpacing.xxl,
                      AppSpacing.screen,
                      AppSpacing.sm,
                    ),
                    child: Text(
                      'PUBLICAÇÕES',
                      style: context.typography.monoEyebrow.copyWith(
                        color: colors.ambar,
                      ),
                    ),
                  ),
                ),
                PropertyHighlightsScreen(
                  key: _highlightsKey,
                  accountId: widget.accountId,
                  asSliver: true,
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _OtherIdentity extends StatelessWidget {
  final UserModel user;
  final bool isFollowing;
  final bool loading;
  final VoidCallback onFollow;
  final VoidCallback onShare;

  const _OtherIdentity({
    required this.user,
    required this.isFollowing,
    required this.loading,
    required this.onFollow,
    required this.onShare,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screen,
          AppSpacing.sm,
          AppSpacing.screen,
          0,
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              right: -70,
              top: -40,
              child: SprayGlow(color: colors.ambar, size: 190, intensity: 0.14),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Semantics(
                      button: true,
                      label: 'Voltar',
                      child: VibesterPressable(
                        onTap: () => Navigator.maybePop(context),
                        borderRadius: AppRadius.smAll,
                        child: Container(
                          width: 44,
                          height: 44,
                          alignment: Alignment.center,
                          decoration: BoxDecoration(
                            color: colors.surface,
                            borderRadius: AppRadius.smAll,
                            border: Border.all(color: colors.hairline),
                          ),
                          child: Icon(
                            Icons.arrow_back_rounded,
                            size: 20,
                            color: colors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                    const Spacer(),
                    Semantics(
                      button: true,
                      label: 'Compartilhar perfil',
                      child: VibesterPressable(
                        onTap: onShare,
                        borderRadius: AppRadius.pillAll,
                        child: SizedBox(
                          width: 44,
                          height: 44,
                          child: Icon(
                            Icons.ios_share_rounded,
                            size: 20,
                            color: colors.textSecondary,
                          ),
                        ),
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: AppSpacing.lg),

                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Transform.rotate(
                      angle: 0.02,
                      child: Container(
                        decoration: BoxDecoration(
                          boxShadow: [
                            BoxShadow(
                              color: colors.scrim.withValues(alpha: 0.5),
                              offset: const Offset(4, 4),
                            ),
                          ],
                        ),
                        child: ClipRRect(
                          borderRadius: const BorderRadius.only(
                            topLeft: Radius.circular(AppRadius.sm),
                            topRight: Radius.circular(AppRadius.sm),
                            bottomRight: Radius.circular(AppRadius.sm),
                          ),
                          child: SizedBox(
                            width: 92,
                            height: 106,
                            child: Stack(
                              fit: StackFit.expand,
                              children: [
                                VibesterImage(
                                  source: user.fotoPerfil,
                                  placeholderIcon: Icons.person_outline_rounded,
                                ),
                                const Grain(opacity: 0.06, density: 0.5),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(width: AppSpacing.lg),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const SizedBox(height: AppSpacing.sm),
                          Text(
                            user.nome.isEmpty ? 'Sem nome' : user.nome,
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                            style: type.headlineLarge.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            formatHandle(user.nomeUsuario).isEmpty
                                ? '@—'
                                : formatHandle(user.nomeUsuario),
                            style: type.monoSmall.copyWith(color: colors.ambar),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),

                if (user.bio.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    user.bio,
                    style: type.bodyLarge.copyWith(color: colors.textSecondary),
                  ),
                ],

                const SizedBox(height: AppSpacing.lg),
                Row(
                  children: [
                    for (final (i, cell) in <(int, String)>[
                      (user.totalPosts, 'POSTS'),
                      (user.seguidores, 'SEGUIDORES'),
                      (user.seguindo, 'SEGUINDO'),
                    ].indexed) ...[
                      if (i > 0)
                        Container(
                          width: 1,
                          height: 28,
                          margin: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.lg,
                          ),
                          color: colors.hairline,
                        ),
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            cell.$1.toString(),
                            style: type.monoDisplay.copyWith(
                              color: colors.textPrimary,
                              fontSize: 20,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            cell.$2,
                            style: type.monoMicro.copyWith(
                              color: colors.textDisabled,
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),

                const SizedBox(height: AppSpacing.xl),
                VibesterButton(
                  label: 'Seguir',
                  successLabel: 'Seguindo',
                  icon: Icons.person_add_alt_1_rounded,
                  variant: isFollowing
                      ? VibesterButtonVariant.outline
                      : VibesterButtonVariant.primary,
                  state: loading
                      ? VibesterButtonState.loading
                      : isFollowing
                      ? VibesterButtonState.success
                      : VibesterButtonState.idle,
                  onPressed: onFollow,
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
