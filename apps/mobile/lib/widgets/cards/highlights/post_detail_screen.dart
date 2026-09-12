import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/service/posts/post_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/media/post_media_carousel.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:provider/provider.dart';

/// Publicação em tela cheia.
///
/// A foto assume a tela inteira, com as ações e a legenda por cima — a mesma
/// leitura do cartaz de evento, aplicada ao conteúdo social. A mídia é o
/// `PostMediaCarousel`, o mesmo do feed: fotos e vídeos na ordem do post, com
/// indicador em traços e contador "2/4".
class PostDetailScreen extends StatefulWidget {
  final HighlightModel highlight;

  const PostDetailScreen({super.key, required this.highlight});

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  final PostService _postService = PostService();
  late HighlightModel _highlight;
  bool _isTogglingLike = false;

  @override
  void initState() {
    super.initState();
    _highlight = widget.highlight;
  }

  Future<void> _alternarCurtida() async {
    final userId = context.read<UserProvider>().user?.accountId;
    if (userId == null || _isTogglingLike) return;

    final curtiaAntes = _highlight.curtidoPeloUsuario;
    setState(() {
      _isTogglingLike = true;
      _highlight = _highlight.copyWith(
        curtidoPeloUsuario: !curtiaAntes,
        totalCurtidas: curtiaAntes
            ? _highlight.totalCurtidas - 1
            : _highlight.totalCurtidas + 1,
      );
    });

    try {
      if (curtiaAntes) {
        await _postService.unlikePost(
          postId: _highlight.postId,
          userId: userId,
        );
      } else {
        await _postService.likePost(postId: _highlight.postId, userId: userId);
      }
    } catch (e) {
      final is409 =
          e.toString().contains('409') ||
          e.toString().contains('already liked') ||
          e.toString().contains('already unliked');
      // 409 significa que o backend já está no estado pra onde tentamos ir
      // (ex: curtida duplicada por uma corrida com outra tela) — mantém a UI.
      if (!is409 && mounted) {
        setState(() {
          _highlight = _highlight.copyWith(
            curtidoPeloUsuario: curtiaAntes,
            totalCurtidas: _highlight.totalCurtidas + (curtiaAntes ? 1 : -1),
          );
        });
      }
    } finally {
      if (mounted) setState(() => _isTogglingLike = false);
    }
  }

  String _formatarData(String isoDate) {
    if (isoDate.isEmpty) return '';
    try {
      final data = DateTime.parse(isoDate);
      return DateFormat("d 'de' MMMM 'de' y", 'pt_BR').format(data);
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final highlight = _highlight;
    final dataFormatada = _formatarData(highlight.criadoEm);

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          ListView(
            padding: EdgeInsets.zero,
            children: [
              AspectRatio(
                aspectRatio: 4 / 5,
                child: PostMediaCarousel(media: highlight.midias),
              ),

              Padding(
                padding: const EdgeInsets.all(AppSpacing.screen),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        _Action(
                          icon: highlight.curtidoPeloUsuario
                              ? Icons.favorite
                              : Icons.favorite_border_rounded,
                          value: highlight.totalCurtidas,
                          active: highlight.curtidoPeloUsuario,
                          onTap: _alternarCurtida,
                        ),
                        const SizedBox(width: AppSpacing.lg),
                        _Action(
                          icon: Icons.mode_comment_outlined,
                          value: highlight.totalComentarios,
                        ),
                      ],
                    ),

                    if (highlight.legenda.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.lg),
                      Text(
                        highlight.legenda,
                        style: type.bodyLarge.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                    ],

                    if (dataFormatada.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.md),
                      Text(
                        dataFormatada.toUpperCase(),
                        style: type.monoMicro.copyWith(
                          color: colors.textDisabled,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),

          // Voltar flutuando sobre a foto, com o padding do topo respeitado.
          Positioned(
            top: MediaQuery.of(context).padding.top + AppSpacing.sm,
            left: AppSpacing.lg,
            child: Semantics(
              button: true,
              label: 'Voltar',
              child: VibesterPressable(
                onTap: () => Navigator.maybePop(context),
                borderRadius: AppRadius.pillAll,
                child: Container(
                  width: 44,
                  height: 44,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.scrim.withValues(alpha: 0.55),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.14),
                    ),
                  ),
                  child: const Icon(
                    Icons.arrow_back_rounded,
                    size: 20,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Ação com contador (curtir, comentar). Contador em DM Mono; alvo de 44px
/// mesmo com o ícone pequeno.
class _Action extends StatelessWidget {
  final IconData icon;
  final int value;
  final bool active;
  final VoidCallback? onTap;

  const _Action({
    required this.icon,
    required this.value,
    this.active = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final color = active ? context.colors.brasa : context.colors.textSecondary;

    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: SizedBox(
        height: 44,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 22, color: color),
            const SizedBox(width: AppSpacing.sm),
            Text(
              value.toString().padLeft(2, '0'),
              style: context.typography.mono.copyWith(color: color),
            ),
          ],
        ),
      ),
    );
  }
}
