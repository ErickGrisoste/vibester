import 'package:flutter/material.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/screens/highlights/property_highlights_screen.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/utils/username.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_tag.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

/// VOCÊ — o perfil do próprio usuário.
///
/// A versão anterior era, na prática, uma tela administrativa: avatar
/// centralizado, três contadores, dois botões de contorno idênticos
/// ("Configurações" e "Compartilhar perfil", mesmo peso, mesma largura) e três
/// abas, duas delas repetindo listas que já existiam em outra parte do app
/// (favoritos e check-ins agora vivem em "Seus rolês").
///
/// A daqui responde outra pergunta: *quem é essa pessoa?* Nome grande, foto
/// tratada como retrato colado, os interesses reais do usuário como etiquetas,
/// e a grade de fotos ocupando o resto — porque é o que a pessoa fez, e é isso
/// que dá vibe a um perfil. Ajustes e sessão ficam num canto discreto: são
/// manutenção, não identidade.
class UserProfileScreen extends StatefulWidget {
  const UserProfileScreen({super.key});

  @override
  State<UserProfileScreen> createState() => UserProfileScreenState();
}

class UserProfileScreenState extends State<UserProfileScreen> {
  final UserService _userService = UserService();
  final GlobalKey<PropertyHighlightsScreenState> _highlightsKey = GlobalKey();

  /// Chamado pela casca da Home ao entrar neste destino: as telas do
  /// `IndexedStack` são montadas uma vez só e não se atualizariam sozinhas.
  Future<void> refreshProfileData() => _fetchProfile();

  Future<void> _fetchProfile() async {
    final user = context.read<UserProvider>().user;
    final accountId = user?.accountId;
    if (accountId == null) return;

    try {
      final profileData = await _userService.getProfile(accountId);
      final atualizado = UserModel.fromProfileJson(
        profileData,
        accountId: accountId,
        token: user?.token,
      );
      if (mounted) context.read<UserProvider>().setUser(atualizado);
    } catch (_) {
      // Mantém os dados atuais em tela caso a atualização falhe.
    }
  }

  Future<void> _onRefresh() async {
    await _fetchProfile();
    await _highlightsKey.currentState?.refresh();
  }

  Future<void> _shareProfile() async {
    final accountId = context.read<UserProvider>().user?.accountId;
    if (accountId == null) return;

    try {
      final shareUrl = await _userService.generateShareLink(accountId);
      await SharePlus.instance.share(
        ShareParams(
          text: 'Meu perfil no Vibester: $shareUrl',
          subject: 'Meu perfil no Vibester',
        ),
      );
    } catch (e) {
      if (!mounted) return;
      // Mensagem tratada: nunca a exceção crua na tela.
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível gerar o link agora')),
      );
      debugPrint('Falha ao compartilhar perfil: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final user = context.watch<UserProvider>().user;

    if (user == null) {
      return Scaffold(
        backgroundColor: colors.noturno,
        body: const Padding(
          padding: EdgeInsets.all(AppSpacing.screen),
          child: VibesterSkeletonLines(lines: 4, spacing: AppSpacing.lg),
        ),
      );
    }

    return Scaffold(
      backgroundColor: colors.noturno,
      body: RefreshIndicator(
        color: colors.ambar,
        backgroundColor: colors.surface,
        onRefresh: _onRefresh,
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(child: _ProfileIdentity(user: user)),
            SliverToBoxAdapter(child: _ProfileActions(onShare: _shareProfile)),
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.screen,
                  AppSpacing.xxl,
                  AppSpacing.screen,
                  AppSpacing.sm,
                ),
                child: Row(
                  children: [
                    Text(
                      'SEUS REGISTROS',
                      style: context.typography.monoEyebrow.copyWith(
                        color: colors.ambar,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      user.totalPosts.toString().padLeft(2, '0'),
                      style: context.typography.monoSmall.copyWith(
                        color: colors.textDisabled,
                      ),
                    ),
                  ],
                ),
              ),
            ),
            PropertyHighlightsScreen(
              key: _highlightsKey,
              accountId: user.accountId ?? '',
              asSliver: true,
            ),
          ],
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------

class _ProfileIdentity extends StatelessWidget {
  final UserModel user;

  const _ProfileIdentity({required this.user});

  /// `interesses` chega da API como texto único; aceita vírgula ou barra como
  /// separador porque as duas formas aparecem nos dados existentes.
  List<String> get _interests => user.interesses
      .split(RegExp(r'[,/;]'))
      .map((e) => e.trim())
      .where((e) => e.isNotEmpty)
      .toList();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screen,
          AppSpacing.lg,
          AppSpacing.screen,
          0,
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Positioned(
              right: -70,
              top: -50,
              child: SprayGlow(color: colors.brasa, size: 200, intensity: 0.16),
            ),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Retrato colado: quadrado com canto rasgado e leve
                    // inclinação, no lugar do avatar circular centralizado.
                    Transform.rotate(
                      angle: -0.022,
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
                _Counters(user: user),

                if (_interests.isNotEmpty) ...[
                  const SizedBox(height: AppSpacing.lg),
                  Text(
                    'SUA VIBE',
                    style: type.monoEyebrow.copyWith(color: colors.textMuted),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Wrap(
                    spacing: AppSpacing.sm,
                    runSpacing: AppSpacing.sm,
                    children: [
                      for (final interest in _interests)
                        VibesterTag(interest, tone: TagTone.outline),
                    ],
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }
}

/// Contadores em DM Mono, alinhados à esquerda numa fileira só. Todos vêm de
/// `fromProfileJson` — nenhum é decorativo.
class _Counters extends StatelessWidget {
  final UserModel user;

  const _Counters({required this.user});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Row(
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
              margin: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              color: colors.hairline,
            ),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                cell.$1.toString(),
                style: context.typography.monoDisplay.copyWith(
                  color: colors.textPrimary,
                  fontSize: 20,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                cell.$2,
                style: context.typography.monoMicro.copyWith(
                  color: colors.textDisabled,
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }
}

/// Ações do perfil. Uma principal, larga e óbvia ("Seus rolês" — o conteúdo
/// que o usuário salvou), e as de manutenção reduzidas a ícones ao lado.
class _ProfileActions extends StatelessWidget {
  final VoidCallback onShare;

  const _ProfileActions({required this.onShare});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.xl,
        AppSpacing.screen,
        0,
      ),
      child: Row(
        children: [
          Expanded(
            child: VibesterPressable(
              onTap: () => Navigator.pushNamed(context, AppRoutes.saved),
              borderRadius: AppRadius.pillAll,
              child: Container(
                height: 52,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.ambar,
                  borderRadius: AppRadius.pillAll,
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.bookmark_rounded,
                      size: 18,
                      color: colors.onAmbar,
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      'Seus rolês',
                      style: context.typography.titleMedium.copyWith(
                        color: colors.onAmbar,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          _IconAction(
            icon: Icons.ios_share_rounded,
            label: 'Compartilhar perfil',
            onTap: onShare,
          ),
          const SizedBox(width: AppSpacing.sm),
          _IconAction(
            icon: Icons.tune_rounded,
            label: 'Configurações',
            onTap: () => Navigator.pushNamed(context, AppRoutes.settings),
          ),
        ],
      ),
    );
  }
}

class _IconAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _IconAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      label: label,
      child: VibesterPressable(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: Container(
          width: 52,
          height: 52,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            border: Border.all(color: colors.outline),
          ),
          child: Icon(icon, size: 20, color: colors.textPrimary),
        ),
      ),
    );
  }
}
