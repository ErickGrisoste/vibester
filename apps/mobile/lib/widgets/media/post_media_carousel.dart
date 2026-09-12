import 'package:flutter/material.dart';
import 'package:mobile/models/media/post_media.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:video_player/video_player.dart';

/// A mídia de um post publicado — feed e tela de detalhe usam o mesmo.
///
/// Foto vira imagem, vídeo vira player (com a capa até o play), na ordem de
/// `media`. Com mais de um item, o indicador em traços e o contador "2/4" em
/// DM Mono: com quatro ou mais itens, bolinhas param de dizer onde você está.
///
/// O carrossel não impõe proporção: quem usa põe num `AspectRatio` (4:5 no
/// feed e no detalhe) e a mídia preenche com `cover`.
class PostMediaCarousel extends StatefulWidget {
  final List<PostMedia> media;

  /// Grão por cima de cada item (feed). Fica abaixo dos controles do vídeo e
  /// nunca intercepta toque — senão o arrastar do carrossel morreria nele.
  final bool grain;

  /// Indicador no topo (feed, onde o selo de local ocupa a base) ou na base
  /// (detalhe, onde o topo é do botão de voltar).
  final bool indicatorOnTop;

  const PostMediaCarousel({
    super.key,
    required this.media,
    this.grain = false,
    this.indicatorOnTop = false,
  });

  @override
  State<PostMediaCarousel> createState() => _PostMediaCarouselState();
}

class _PostMediaCarouselState extends State<PostMediaCarousel> {
  final _controller = PageController();
  int _page = 0;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Widget _item(PostMedia media) {
    if (media.isVideo) return FeedVideo(media: media, grain: widget.grain);
    return Stack(
      fit: StackFit.expand,
      children: [
        VibesterImage(
          source: media.url,
          placeholderIcon: Icons.photo_camera_outlined,
        ),
        if (widget.grain)
          const IgnorePointer(child: Grain(opacity: 0.05, density: 0.35)),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final media = widget.media;
    if (media.isEmpty) {
      return const VibesterImage(
        source: '',
        placeholderIcon: Icons.photo_camera_outlined,
      );
    }
    if (media.length == 1) return _item(media.first);

    return Stack(
      fit: StackFit.expand,
      children: [
        PageView.builder(
          controller: _controller,
          itemCount: media.length,
          onPageChanged: (i) => setState(() => _page = i),
          itemBuilder: (context, i) => _item(media[i]),
        ),
        Positioned(
          left: AppSpacing.lg,
          right: AppSpacing.lg,
          top: widget.indicatorOnTop ? AppSpacing.md : null,
          bottom: widget.indicatorOnTop ? null : AppSpacing.lg,
          child: IgnorePointer(
            child: _PageIndicator(count: media.length, page: _page),
          ),
        ),
      ],
    );
  }
}

class _PageIndicator extends StatelessWidget {
  final int count;
  final int page;

  const _PageIndicator({required this.count, required this.page});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      label: 'Item ${page + 1} de $count',
      child: Row(
        children: [
          for (var i = 0; i < count; i++)
            Expanded(
              child: AnimatedContainer(
                duration: context.adaptiveMotion(AppMotion.micro),
                curve: AppMotion.standard,
                margin: const EdgeInsets.only(right: AppSpacing.xs),
                height: 3,
                decoration: BoxDecoration(
                  color: i == page
                      ? colors.ambar
                      : colors.onFill(colors.scrim).withValues(alpha: 0.35),
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
          const SizedBox(width: AppSpacing.sm),
          Text(
            '${page + 1}/$count',
            style: context.typography.monoMicro.copyWith(
              color: colors.onFill(colors.scrim),
            ),
          ),
        ],
      ),
    );
  }
}

/// Vídeo de um post: capa parada até o toque, depois player em loop.
///
/// Não toca sozinho — reprodução automática no feed gasta o plano de dados de
/// quem só está rolando, e o público do app está no 4G da rua. Regras de
/// recurso, porque o feed pode ter dezenas de vídeos:
///
/// * **um player por vez no app inteiro**: dar play num vídeo descarta o
///   anterior (controller e decodificador), não só pausa;
/// * o player só é criado no primeiro play, e é descartado quando o item sai
///   da árvore (rolagem, página do carrossel);
/// * pausa quando a aba some (`TickerMode`), quando outra tela cobre esta
///   (`ModalRoute.isCurrent`) e quando o app vai para segundo plano.
class FeedVideo extends StatefulWidget {
  final PostMedia media;
  final bool grain;

  const FeedVideo({super.key, required this.media, this.grain = false});

  @override
  State<FeedVideo> createState() => _FeedVideoState();
}

class _FeedVideoState extends State<FeedVideo> with WidgetsBindingObserver {
  /// O único vídeo com player aberto.
  static _FeedVideoState? _active;

  VideoPlayerController? _controller;
  bool _loading = false;
  bool _failed = false;
  bool _muted = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final visible =
        TickerMode.of(context) && (ModalRoute.isCurrentOf(context) ?? true);
    if (!visible) _controller?.pause();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) _controller?.pause();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _release(rebuild: false);
    super.dispose();
  }

  Future<void> _toggle() async {
    final controller = _controller;
    if (controller != null && controller.value.isInitialized) {
      controller.value.isPlaying ? await controller.pause() : await _play();
      return;
    }
    if (!_loading) await _play();
  }

  Future<void> _play() async {
    if (_active != this) {
      _active?._release();
      _active = this;
    }

    var controller = _controller;
    if (controller == null) {
      controller = VideoPlayerController.networkUrl(
        Uri.parse(widget.media.url),
      );
      _controller = controller;
      setState(() {
        _loading = true;
        _failed = false;
      });
      try {
        await controller.initialize();
        await controller.setLooping(true);
        await controller.setVolume(_muted ? 0 : 1);
      } catch (e) {
        // Outro vídeo assumiu no meio e descartou este: não é falha de rede.
        if (_controller != controller) return;
        debugPrint('Vídeo não abriu: $e');
        _release();
        if (mounted) setState(() => _failed = true);
        return;
      }
      if (!mounted || _controller != controller) return;
      setState(() => _loading = false);
    }
    await controller.play();
  }

  void _toggleMute() {
    setState(() => _muted = !_muted);
    _controller?.setVolume(_muted ? 0 : 1);
  }

  void _release({bool rebuild = true}) {
    final controller = _controller;
    _controller = null;
    controller?.dispose();
    if (_active == this) _active = null;
    if (rebuild && mounted) setState(() => _loading = false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final controller = _controller;
    final ready = controller != null && controller.value.isInitialized;

    return Semantics(
      button: true,
      label: _failed
          ? 'Vídeo não carregou. Toca pra tentar de novo'
          : 'Vídeo. Toca pra tocar ou pausar',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _toggle,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (ready)
              ClipRect(
                child: FittedBox(
                  fit: BoxFit.cover,
                  child: SizedBox(
                    width: controller.value.size.width,
                    height: controller.value.size.height,
                    child: VideoPlayer(controller),
                  ),
                ),
              )
            else
              VibesterImage(
                source: widget.media.coverUrl,
                placeholderIcon: Icons.videocam_outlined,
              ),
            if (widget.grain)
              const IgnorePointer(child: Grain(opacity: 0.05, density: 0.35)),
            Center(
              child: _failed
                  ? _Notice(
                      icon: Icons.refresh_rounded,
                      text: 'NÃO CARREGOU · TOCA DE NOVO',
                    )
                  : _loading
                  ? SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: colors.ambar,
                      ),
                    )
                  : ready
                  ? ValueListenableBuilder<VideoPlayerValue>(
                      valueListenable: controller,
                      builder: (context, value, _) => AnimatedOpacity(
                        opacity: value.isPlaying ? 0 : 1,
                        duration: context.adaptiveMotion(AppMotion.micro),
                        child: const _PlayMark(),
                      ),
                    )
                  : const _PlayMark(),
            ),
            if (ready)
              Positioned(
                right: AppSpacing.sm,
                bottom: AppSpacing.sm,
                child: Semantics(
                  button: true,
                  label: _muted ? 'Ligar o som' : 'Tirar o som',
                  excludeSemantics: true,
                  child: GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: _toggleMute,
                    child: SizedBox(
                      width: 44,
                      height: 44,
                      child: Center(
                        child: Container(
                          width: 32,
                          height: 32,
                          decoration: BoxDecoration(
                            color: colors.scrim.withValues(alpha: 0.55),
                            shape: BoxShape.circle,
                          ),
                          child: Icon(
                            _muted
                                ? Icons.volume_off_rounded
                                : Icons.volume_up_rounded,
                            size: 16,
                            color: colors.onFill(colors.scrim),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _PlayMark extends StatelessWidget {
  const _PlayMark();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: 56,
      height: 56,
      decoration: BoxDecoration(
        color: colors.scrim.withValues(alpha: 0.45),
        shape: BoxShape.circle,
        border: Border.all(
          color: colors.onFill(colors.scrim).withValues(alpha: 0.6),
        ),
      ),
      child: Icon(
        Icons.play_arrow_rounded,
        size: 32,
        color: colors.onFill(colors.scrim),
      ),
    );
  }
}

class _Notice extends StatelessWidget {
  final IconData icon;
  final String text;

  const _Notice({required this.icon, required this.text});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.md,
        vertical: AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.scrim.withValues(alpha: 0.6),
        borderRadius: AppRadius.pillAll,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: colors.onFill(colors.scrim)),
          const SizedBox(width: AppSpacing.sm),
          Text(
            text,
            style: context.typography.monoMicro.copyWith(
              color: colors.onFill(colors.scrim),
            ),
          ),
        ],
      ),
    );
  }
}
