import 'dart:math';

import 'package:flutter/material.dart';
import 'package:mobile/models/safety/blocked_profile.dart';
import 'package:mobile/models/safety/report_reason.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/safety/block_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/screens/highlights/property_highlights_screen.dart';
import 'package:mobile/service/safety/safety_service.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/utils/username.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/media/profile_photo_viewer.dart';
import 'package:mobile/widgets/motion/presence_pop.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:mobile/widgets/motion/vibester_shake.dart';
import 'package:mobile/widgets/safety/report_sheet.dart';
import 'package:mobile/widgets/safety/safety_actions.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

/// Perfil de outra pessoa.
///
/// Mesma composição do perfil próprio (retrato colado, nome grande, números em
/// DM Mono, grade de fotos), com a ação trocada: onde o seu perfil tem "Seus
/// rolês", aqui fica **Seguir** — a única decisão que essa tela pede.
///
/// O menu ⋯ oferece denunciar e bloquear (App Store Guideline 1.2). Perfil
/// bloqueado esconde as publicações e troca Seguir por Desbloquear; perfil que
/// bloqueou quem está vendo aparece como indisponível.
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
  final SafetyService _safetyService = SafetyService();
  final GlobalKey<PropertyHighlightsScreenState> _highlightsKey = GlobalKey();

  late Future<UserModel> _userFuture = _loadUser();

  bool _isFollowing = false;
  bool _loadingFollow = false;

  /// Situação de bloqueio lida do backend ao abrir. O lado "eu bloqueei" também
  /// é refletido pelo [BlockProvider], que muda na hora ao bloquear.
  BlockStatus _blockStatus = BlockStatus.none;
  bool _loadingUnblock = false;

  // Gatilhos de animação do botão, só por ação do usuário: seguir celebra
  // como confirmar presença; deixar de seguir (ou voltar atrás por erro) treme.
  int _followPops = 0;
  int _followShakes = 0;

  Future<UserModel> _loadUser() async {
    final currentUserId = context.read<UserProvider>().user?.accountId;
    final logado = currentUserId != null;

    final results = await Future.wait<Object>([
      _userService.getProfile(widget.accountId),
      logado
          ? _userService.isFollowing(
              followerId: currentUserId,
              followingId: widget.accountId,
            )
          : Future.value(false),
      // Falha aqui não pode esconder o perfil: sem a resposta, trata como sem
      // bloqueio (o backend continua impedindo seguir quem bloqueou).
      logado
          ? _safetyService
                .status(widget.accountId)
                .catchError((Object _) => BlockStatus.none)
          : Future.value(BlockStatus.none),
    ]);

    final profileData = results[0] as Map<String, dynamic>;
    final isFollowing = results[1] as bool;
    final blockStatus = results[2] as BlockStatus;

    if (mounted) {
      setState(() {
        _isFollowing = isFollowing;
        _blockStatus = blockStatus;
      });
    }

    return UserModel.fromProfileJson(profileData, accountId: widget.accountId);
  }

  bool get _podeModerar {
    final currentUserId = context.read<UserProvider>().user?.accountId;
    return currentUserId != null && currentUserId != widget.accountId;
  }

  bool _bloqueando(BlockProvider blocks) =>
      blocks.isBlocked(widget.accountId) ||
      (_blockStatus.bloqueando && !_desbloqueadoNestaTela);

  /// Desbloquear pelo botão desta tela precisa vencer o `bloqueando` que veio
  /// do backend ao abrir.
  bool _desbloqueadoNestaTela = false;

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
      if (seguiaAntes) {
        _followShakes++;
      } else {
        _followPops++;
      }
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
        // Voltar atrás por erro treme, nunca celebra.
        _followShakes++;
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

  Future<void> _abrirOpcoes(UserModel user) async {
    final bloqueando = _bloqueando(context.read<BlockProvider>());

    final action = await showSafetyActionsSheet(
      context,
      actions: [
        SafetyAction.reportProfile,
        bloqueando ? SafetyAction.unblock : SafetyAction.block,
      ],
    );
    if (!mounted || action == null) return;

    switch (action) {
      case SafetyAction.reportProfile:
        await showReportSheet(
          context,
          targetType: ReportTargetType.user,
          targetId: widget.accountId,
        );
      case SafetyAction.block:
        final bloqueado = await confirmAndBlockUser(
          context,
          accountId: widget.accountId,
          displayName: user.nome,
        );
        if (bloqueado && mounted) {
          setState(() {
            _desbloqueadoNestaTela = false;
            // O backend desfaz o follow; o contador acompanha.
            if (_isFollowing) {
              _isFollowing = false;
              user.seguidores = max(0, user.seguidores - 1);
            }
          });
        }
      case SafetyAction.unblock:
        await _desbloquear();
      case SafetyAction.reportPost:
        break;
    }
  }

  Future<void> _desbloquear() async {
    if (_loadingUnblock) return;
    setState(() => _loadingUnblock = true);
    final ok = await unblockUser(context, accountId: widget.accountId);
    if (!mounted) return;
    setState(() {
      _loadingUnblock = false;
      if (ok) _desbloqueadoNestaTela = true;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final blocks = context.watch<BlockProvider>();

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
          final bloqueando = _bloqueando(blocks);

          if (_blockStatus.bloqueadoPor && !bloqueando) {
            return SafeArea(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Padding(
                    padding: EdgeInsets.fromLTRB(
                      AppSpacing.screen,
                      AppSpacing.sm,
                      AppSpacing.screen,
                      0,
                    ),
                    child: _BackButton(),
                  ),
                  const Expanded(
                    child: VibesterState(
                      headline: 'Perfil indisponível',
                      message: 'Esse perfil não está disponível pra você.',
                      icon: Icons.person_off_outlined,
                    ),
                  ),
                ],
              ),
            );
          }

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
                    pops: _followPops,
                    shakes: _followShakes,
                    blocked: bloqueando,
                    loadingUnblock: _loadingUnblock,
                    onFollow: () => _alternarSeguir(user),
                    onUnblock: _desbloquear,
                    onShare: _shareProfile,
                    onMore: _podeModerar ? () => _abrirOpcoes(user) : null,
                  ),
                ),
                if (bloqueando)
                  SliverToBoxAdapter(
                    child: Padding(
                      padding: const EdgeInsets.all(AppSpacing.screen),
                      child: Text(
                        'Você bloqueou este perfil. As publicações ficam '
                        'ocultas enquanto o bloqueio existir.',
                        style: context.typography.bodyMedium.copyWith(
                          color: colors.textMuted,
                        ),
                      ),
                    ),
                  )
                else ...[
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
              ],
            ),
          );
        },
      ),
    );
  }
}

class _BackButton extends StatelessWidget {
  const _BackButton();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
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
    );
  }
}

class _OtherIdentity extends StatelessWidget {
  final UserModel user;
  final bool isFollowing;
  final bool loading;
  final int pops;
  final int shakes;
  final bool blocked;
  final bool loadingUnblock;
  final VoidCallback onFollow;
  final VoidCallback onUnblock;
  final VoidCallback onShare;

  /// Nulo quando não há sessão (link aberto deslogado): denunciar e bloquear
  /// exigem conta.
  final VoidCallback? onMore;

  const _OtherIdentity({
    required this.user,
    required this.isFollowing,
    required this.loading,
    required this.pops,
    required this.shakes,
    required this.blocked,
    required this.loadingUnblock,
    required this.onFollow,
    required this.onUnblock,
    required this.onShare,
    this.onMore,
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
                    const _BackButton(),
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
                    if (onMore != null)
                      Semantics(
                        button: true,
                        label: 'Mais opções do perfil',
                        child: VibesterPressable(
                          onTap: onMore,
                          borderRadius: AppRadius.pillAll,
                          child: SizedBox(
                            width: 44,
                            height: 44,
                            child: Icon(
                              Icons.more_horiz_rounded,
                              size: 22,
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
                            child: ProfilePortraitPhoto(
                              source: user.fotoPerfil,
                              accountId: user.accountId ?? '',
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

                if (user.bio.isNotEmpty && !blocked) ...[
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
                if (blocked)
                  VibesterButton(
                    label: 'Desbloquear',
                    icon: Icons.lock_open_rounded,
                    variant: VibesterButtonVariant.outline,
                    state: loadingUnblock
                        ? VibesterButtonState.loading
                        : VibesterButtonState.idle,
                    onPressed: onUnblock,
                  )
                else
                  // Seguir celebra como confirmar presença; deixar de seguir
                  // (ou voltar atrás por erro) mantém a tremida.
                  VibesterShake(
                    trigger: shakes,
                    child: PresencePop(
                      trigger: pops,
                      child: VibesterButton(
                        shakeOnStateChange: false,
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
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
