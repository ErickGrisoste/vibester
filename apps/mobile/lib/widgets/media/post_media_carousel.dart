import 'package:flutter/material.dart';
import 'package:mobile/models/media/post_media.dart';
import 'package:mobile/service/media/image_cache.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:video_player/video_player.dart';

/// A mídia de um post publicado — feed e tela de detalhe usam o mesmo.
///
/// Foto vira imagem, vídeo vira player (com a capa até o play), na ordem de
/// `media`. Com mais de um item, o indicador em bolinhas (a atual maior, em
/// âmbar) e o contador "2/4" em DM Mono, que diz a posição quando há muitas.
///
/// O carrossel não impõe proporção: quem usa põe num `AspectRatio` (4:5 no
/// feed e no detalhe) e a mídia preenche com `cover`.
class PostMediaCarousel extends StatefulWidget {
  final List<PostMedia> media;

  /// Grão por cima de cada item (feed). Fica abaixo dos controles do vídeo e
  /// nunca intercepta toque — senão o arrastar do carrossel morreria nele.
  final bool grain;

  /// As bolinhas ficam sempre na base. O contador "2/4" vai junto delas
  /// (detalhe, onde o topo é do botão de voltar) ou sozinho no canto superior
  /// direito (feed).
  final bool counterOnTop;

  const PostMediaCarousel({
    super.key,
    required this.media,
    this.grain = false,
    this.counterOnTop = false,
  });

  @override
  State<PostMediaCarousel> createState() => _PostMediaCarouselState();
}

class _PostMediaCarouselState extends State<PostMediaCarousel> {
  final _controller = PageController();
  int _page = 0;

  @override
  void initState() {
    super.initState();
    if (widget.media.length > 1) _warmAround(0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  /// Só a vizinha seguinte: pré-carregar o carrossel inteiro gastaria o plano
  /// de dados de quem rola o feed sem arrastar nenhum post.
  void _warmAround(int page) {
    final next = page + 1;
    if (next < widget.media.length) {
      VibesterImageCache.warm(widget.media[next].coverUrl);
    }
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
          onPageChanged: (i) {
            setState(() => _page = i);
            _warmAround(i);
          },
          itemBuilder: (context, i) => _item(media[i]),
        ),
        Positioned(
          left: AppSpacing.lg,
          right: AppSpacing.lg,
          bottom: AppSpacing.lg,
          child: IgnorePointer(
            child: Semantics(
              label: 'Item ${_page + 1} de ${media.length}',
              child: Row(
                children: [
                  Expanded(
                    child: _PageDots(count: media.length, page: _page),
                  ),
                  if (!widget.counterOnTop) ...[
                    const SizedBox(width: AppSpacing.sm),
                    _PageCounter(count: media.length, page: _page),
                  ],
                ],
              ),
            ),
          ),
        ),
        if (widget.counterOnTop)
          Positioned(
            top: AppSpacing.md,
            right: AppSpacing.lg,
            child: IgnorePointer(
              child: ExcludeSemantics(
                child: _PageCounter(count: media.length, page: _page),
              ),
            ),
          ),
      ],
    );
  }
}

class _PageDots extends StatelessWidget {
  final int count;
  final int page;

  const _PageDots({required this.count, required this.page});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        for (var i = 0; i < count; i++)
          AnimatedContainer(
            duration: context.adaptiveMotion(AppMotion.micro),
            curve: AppMotion.standard,
            width: i == page ? 8 : 6,
            height: i == page ? 8 : 6,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: i == page
                  ? colors.ambar
                  : colors.onFill(colors.scrim).withValues(alpha: 0.35),
            ),
          ),
      ],
    );
  }
}

class _PageCounter extends StatelessWidget {
  final int count;
  final int page;

  const _PageCounter({required this.count, required this.page});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Text(
      '${page + 1}/$count',
      style: context.typography.monoMicro.copyWith(
        color: colors.onFill(colors.scrim),
      ),
    );
  }
}

/// Vídeo de um post: toca sozinho, sem som e em loop, quando aparece na tela.
///
/// Quem vence é o vídeo mais visível (pelo menos [_minVisibleFraction] dele
/// dentro de todas as áreas roláveis acima — a lista do feed e o carrossel);
/// enquanto continua acima do limite, segue tocando mesmo que outro apareça.
/// O toque pausa e retoma, e a pausa manual é respeitada até o vídeo sair de
/// vista. O som começa desligado e a escolha vale para os próximos vídeos.
///
/// Regras de recurso, porque o feed pode ter dezenas de vídeos:
///
/// * **um player por vez no app inteiro**: o vídeo que assume descarta o
///   anterior (controller e decodificador), não só pausa;
/// * o player só é criado quando o vídeo vence, e é descartado quando o item
///   sai da árvore (rolagem, página do carrossel);
/// * nenhum vídeo toca quando a aba some (`TickerMode`), quando outra tela
///   cobre esta (`ModalRoute.isCurrent`) ou com o app em segundo plano.
class FeedVideo extends StatefulWidget {
  final PostMedia media;
  final bool grain;

  const FeedVideo({super.key, required this.media, this.grain = false});

  @override
  State<FeedVideo> createState() => _FeedVideoState();
}

class _FeedVideoState extends State<FeedVideo> with WidgetsBindingObserver {
  /// Quanto do vídeo precisa estar à vista para começar a tocar.
  static const _minVisibleFraction = 0.6;

  /// Todo vídeo montado — os candidatos a tocar.
  static final Set<_FeedVideoState> _mounted = {};

  /// O único vídeo com player aberto.
  static _FeedVideoState? _active;

  static bool _electionScheduled = false;
  static bool _appResumed = true;

  /// Som desligado por padrão; ligar vale para os vídeos seguintes.
  static bool _muted = true;

  VideoPlayerController? _controller;
  bool _loading = false;
  bool _failed = false;

  /// Aba visível e tela no topo da pilha.
  bool _onScreen = false;

  /// A pessoa pausou: a eleição não retoma até o vídeo sair de vista.
  bool _pausedByUser = false;

  final List<ScrollPosition> _scrollPositions = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _mounted.add(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _onScreen =
        TickerMode.of(context) && (ModalRoute.isCurrentOf(context) ?? true);
    _listenToScrollables();
    _scheduleElection();
  }

  /// Escuta a rolagem de todas as áreas roláveis acima (feed e carrossel):
  /// qualquer uma delas muda o quanto do vídeo aparece.
  void _listenToScrollables() {
    final positions = <ScrollPosition>[];
    ScrollableState? scrollable = Scrollable.maybeOf(context);
    while (scrollable != null) {
      positions.add(scrollable.position);
      scrollable = scrollable.context
          .findAncestorStateOfType<ScrollableState>();
    }
    for (final position in _scrollPositions) {
      position.removeListener(_scheduleElection);
    }
    _scrollPositions
      ..clear()
      ..addAll(positions);
    for (final position in _scrollPositions) {
      position.addListener(_scheduleElection);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    _appResumed = state == AppLifecycleState.resumed;
    _scheduleElection();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    for (final position in _scrollPositions) {
      position.removeListener(_scheduleElection);
    }
    _mounted.remove(this);
    _release(rebuild: false);
    _scheduleElection();
    super.dispose();
  }

  /// Decide quem toca no fim do frame, uma vez por frame, depois do layout.
  static void _scheduleElection() {
    if (_electionScheduled) return;
    _electionScheduled = true;
    final binding = WidgetsBinding.instance;
    binding.addPostFrameCallback((_) {
      _electionScheduled = false;
      _elect();
    });
    binding.ensureVisualUpdate();
  }

  static void _elect() {
    final current = _active;
    _FeedVideoState? winner;

    if (_appResumed) {
      if (current != null &&
          current._eligible &&
          current._visibleFraction() >= _minVisibleFraction) {
        winner = current;
      } else {
        var best = _minVisibleFraction;
        for (final video in _mounted) {
          if (video == current || !video._eligible) continue;
          final fraction = video._visibleFraction();
          if (fraction >= best) {
            best = fraction;
            winner = video;
          }
        }
      }
    }

    for (final video in _mounted) {
      if (video != winner && video._pausedByUser) video._pausedByUser = false;
    }

    if (winner == null) {
      // Sem ninguém à vista: pausa, e cancela se ainda estava abrindo.
      final controller = current?._controller;
      if (controller != null && !controller.value.isInitialized) {
        current!._release();
      } else {
        controller?.pause();
      }
      return;
    }
    if (!winner._pausedByUser) winner._play();
  }

  bool get _eligible => mounted && _onScreen && !_failed;

  /// Fração do vídeo dentro da tela e de cada área rolável acima dele.
  double _visibleFraction() {
    final box = context.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return 0;
    final size = box.size;
    if (size.isEmpty) return 0;

    var visible = box.localToGlobal(Offset.zero) & size;
    visible = visible.intersect(Offset.zero & MediaQuery.sizeOf(context));
    for (final position in _scrollPositions) {
      final viewport = position.context.notificationContext?.findRenderObject();
      if (viewport is! RenderBox || !viewport.attached || !viewport.hasSize) {
        continue;
      }
      visible = visible.intersect(
        viewport.localToGlobal(Offset.zero) & viewport.size,
      );
    }
    if (visible.width <= 0 || visible.height <= 0) return 0;
    return (visible.width * visible.height) / (size.width * size.height);
  }

  Future<void> _onTap() async {
    if (_failed) {
      setState(() => _failed = false);
      await _play();
      return;
    }
    final controller = _controller;
    if (controller == null || !controller.value.isInitialized) {
      if (!_loading) await _play();
      return;
    }
    if (controller.value.isPlaying) {
      _pausedByUser = true;
      await controller.pause();
    } else {
      _pausedByUser = false;
      await _play();
    }
  }

  Future<void> _play() async {
    if (_active != this) {
      _active?._release();
      _active = this;
    }
    if (_loading) return;

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
        _scheduleElection();
        return;
      }
      if (!mounted || _controller != controller) return;
      setState(() => _loading = false);
      // Enquanto abria, a pessoa pode ter rolado ou pausado.
      if (_pausedByUser || !_eligible) return;
    }
    if (_muted != (controller.value.volume == 0)) {
      await controller.setVolume(_muted ? 0 : 1);
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
    if (!rebuild) _loading = false;
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
          : 'Vídeo. Toca pra pausar ou continuar',
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _onTap,
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
                  : const SizedBox.shrink(),
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
