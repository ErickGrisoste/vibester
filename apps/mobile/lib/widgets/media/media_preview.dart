import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/media/picked_media.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/clock_format.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/media/media_controls.dart';
import 'package:video_player/video_player.dart';

/// A mídia (uma ou várias, foto ou vídeo) antes de virar post ou avatar: ver,
/// descartar, refazer ou confirmar.
///
/// Nada sobe daqui. Confirmar roda [onConfirm] — no fluxo, o processamento
/// (redimensionar, comprimir) — com o botão em carregamento e, se houver
/// [progress], uma barra do quanto falta; só depois a tela sai. Mídia
/// descartada nunca custa upload nem processamento. Fechar durante o
/// processamento é permitido: quem abriu a prévia cancela o trabalho.
///
/// Usada sobre a câmera (revisão da captura) e como tela própria para o que
/// veio da galeria — a mesma prévia nos dois caminhos.
class MediaPreview extends StatefulWidget {
  final List<PickedMedia> items;
  final Future<void> Function() onConfirm;
  final VoidCallback onClose;
  final String confirmLabel;

  /// Ação secundária ("Refazer" na câmera, "Trocar" na galeria).
  final String? retakeLabel;
  final VoidCallback? onRetake;

  /// Tira um item da seleção. Só aparece com mais de um.
  final ValueChanged<int>? onRemove;

  /// Progresso do processamento, de 0 a 1.
  final ValueListenable<double?>? progress;

  /// Duração máxima de vídeo — o vídeo acima dela ganha o aviso antes de a
  /// pessoa confirmar, em vez de só falhar depois.
  final Duration? maxVideoDuration;

  const MediaPreview({
    super.key,
    required this.items,
    required this.onConfirm,
    required this.onClose,
    this.confirmLabel = 'Usar foto',
    this.retakeLabel,
    this.onRetake,
    this.onRemove,
    this.progress,
    this.maxVideoDuration,
  });

  @override
  State<MediaPreview> createState() => _MediaPreviewState();
}

class _MediaPreviewState extends State<MediaPreview> {
  final _pages = PageController();
  int _page = 0;
  bool _busy = false;

  @override
  void didUpdateWidget(MediaPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (_page >= widget.items.length && widget.items.isNotEmpty) {
      _page = widget.items.length - 1;
    }
  }

  @override
  void dispose() {
    _pages.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.onConfirm();
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: AppTheme.dark,
      child: Builder(builder: _build),
    );
  }

  Widget _build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final multiple = widget.items.length > 1;
    final current = widget.items.isEmpty ? null : widget.items[_page];

    return ColoredBox(
      color: colors.noturno,
      child: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg,
                AppSpacing.sm,
                AppSpacing.lg,
                0,
              ),
              child: Row(
                children: [
                  MediaRoundButton(
                    icon: Icons.close_rounded,
                    semanticLabel: _busy ? 'Cancelar' : 'Descartar',
                    onTap: widget.onClose,
                  ),
                  Expanded(
                    child: Text(
                      multiple
                          ? '${_page + 1} / ${widget.items.length}'
                          : (current?.isVideo ?? false)
                          ? 'PRÉVIA DO VÍDEO'
                          : 'PRÉVIA',
                      textAlign: TextAlign.center,
                      style: type.monoEyebrow.copyWith(color: colors.textMuted),
                    ),
                  ),
                  if (multiple && widget.onRemove != null)
                    MediaRoundButton(
                      icon: Icons.delete_outline_rounded,
                      semanticLabel: 'Tirar este item',
                      onTap: _busy ? null : () => widget.onRemove!(_page),
                    )
                  else
                    const SizedBox(width: 48, height: 48),
                ],
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.sm),
                child: PageView.builder(
                  controller: _pages,
                  itemCount: widget.items.length,
                  onPageChanged: (i) => setState(() => _page = i),
                  itemBuilder: (context, i) {
                    final item = widget.items[i];
                    return item.isVideo
                        ? _PreviewVideo(
                            key: ValueKey(item.path),
                            file: File(item.path),
                            maxDuration: widget.maxVideoDuration,
                          )
                        : _PreviewImage(
                            key: ValueKey(item.path),
                            file: File(item.path),
                          );
                  },
                ),
              ),
            ),
            if (widget.progress != null)
              ValueListenableBuilder<double?>(
                valueListenable: widget.progress!,
                builder: (context, value, _) => _busy && value != null
                    ? _ProgressLine(value: value)
                    : const SizedBox.shrink(),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screen,
                AppSpacing.md,
                AppSpacing.screen,
                AppSpacing.lg,
              ),
              child: Row(
                children: [
                  if (widget.retakeLabel != null) ...[
                    Expanded(
                      child: VibesterButton(
                        label: widget.retakeLabel!,
                        variant: VibesterButtonVariant.outline,
                        onPressed: _busy ? null : widget.onRetake,
                      ),
                    ),
                    const SizedBox(width: AppSpacing.md),
                  ],
                  Expanded(
                    child: VibesterButton(
                      label: widget.confirmLabel,
                      state: _busy
                          ? VibesterButtonState.loading
                          : VibesterButtonState.idle,
                      onPressed: _confirm,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Barra fina do processamento. Só aparece quando há algo demorado (vídeo);
/// foto processa rápido demais para a barra ser mais que um piscar.
class _ProgressLine extends StatelessWidget {
  final double value;

  const _ProgressLine({required this.value});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final percent = (value * 100).clamp(0, 100).round();

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.sm,
        AppSpacing.screen,
        0,
      ),
      child: Semantics(
        label: 'Preparando, $percent por cento',
        child: Row(
          children: [
            Expanded(
              child: ClipRRect(
                borderRadius: AppRadius.pillAll,
                child: LinearProgressIndicator(
                  value: value.clamp(0.0, 1.0),
                  minHeight: 3,
                  color: colors.ambar,
                  backgroundColor: colors.hairline,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Text(
              'PREPARANDO $percent%',
              style: context.typography.monoMicro.copyWith(
                color: colors.textMuted,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Entra com fade + scale, como toda peça da prévia.
class _Enter extends StatelessWidget {
  final Widget child;

  const _Enter({required this.child});

  @override
  Widget build(BuildContext context) {
    return TweenAnimationBuilder<double>(
      tween: Tween(begin: 0, end: 1),
      duration: context.adaptiveMotion(AppMotion.ui),
      curve: AppMotion.enter,
      builder: (context, t, child) => Opacity(
        opacity: t,
        child: Transform.scale(scale: 0.97 + 0.03 * t, child: child),
      ),
      child: child,
    );
  }
}

/// Uma foto inteira na tela, sem corte.
///
/// Decodifica no tamanho da tela (`cacheWidth`), não no do arquivo: a foto da
/// galeria ainda não foi processada, e uma de 12MP decodificada inteira
/// ocuparia ~48MB só para ser exibida reduzida.
class _PreviewImage extends StatelessWidget {
  final File file;

  const _PreviewImage({super.key, required this.file});

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final cacheWidth = (media.size.width * media.devicePixelRatio).round();

    return _Enter(
      child: Center(
        child: ClipRRect(
          borderRadius: AppRadius.lgAll,
          child: Image.file(
            file,
            fit: BoxFit.contain,
            cacheWidth: cacheWidth,
            gaplessPlayback: true,
            errorBuilder: (_, _, _) =>
                const _Unreadable(message: 'NÃO DEU PRA MOSTRAR ESSA FOTO'),
          ),
        ),
      ),
    );
  }
}

/// O vídeo tocando em loop, com a duração — e o aviso quando passa do limite.
///
/// Só o item visível existe (o `PageView` descarta os outros), então nunca
/// há dois players abertos na prévia.
class _PreviewVideo extends StatefulWidget {
  final File file;
  final Duration? maxDuration;

  const _PreviewVideo({super.key, required this.file, this.maxDuration});

  @override
  State<_PreviewVideo> createState() => _PreviewVideoState();
}

class _PreviewVideoState extends State<_PreviewVideo> {
  late final VideoPlayerController _controller;
  bool _ready = false;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _controller = VideoPlayerController.file(widget.file);
    _start();
  }

  Future<void> _start() async {
    try {
      await _controller.initialize();
      await _controller.setLooping(true);
      if (!mounted) return;
      setState(() => _ready = true);
      await _controller.play();
    } catch (e) {
      debugPrint('Prévia de vídeo falhou: $e');
      if (mounted) setState(() => _failed = true);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggle() {
    _controller.value.isPlaying ? _controller.pause() : _controller.play();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    if (_failed) {
      return const _Unreadable(message: 'NÃO DEU PRA MOSTRAR ESSE VÍDEO');
    }
    if (!_ready) {
      return Center(
        child: AspectRatio(
          aspectRatio: 9 / 16,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: AppRadius.lgAll,
            ),
            child: Center(
              child: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: colors.ambar,
                ),
              ),
            ),
          ),
        ),
      );
    }

    final duration = _controller.value.duration;
    final max = widget.maxDuration;
    final tooLong =
        max != null && duration > max + const Duration(milliseconds: 500);

    return _Enter(
      child: Center(
        child: AspectRatio(
          aspectRatio: _controller.value.aspectRatio,
          child: ClipRRect(
            borderRadius: AppRadius.lgAll,
            child: Semantics(
              button: true,
              label: 'Tocar ou pausar o vídeo',
              child: GestureDetector(
                onTap: _toggle,
                child: Stack(
                  fit: StackFit.expand,
                  children: [
                    VideoPlayer(_controller),
                    ValueListenableBuilder<VideoPlayerValue>(
                      valueListenable: _controller,
                      builder: (context, value, _) => AnimatedOpacity(
                        opacity: value.isPlaying ? 0 : 1,
                        duration: context.adaptiveMotion(AppMotion.micro),
                        child: Center(
                          child: Icon(
                            Icons.play_arrow_rounded,
                            size: 56,
                            color: colors.textPrimary,
                          ),
                        ),
                      ),
                    ),
                    Positioned(
                      left: AppSpacing.md,
                      bottom: AppSpacing.md,
                      child: _Chip(
                        text: tooLong
                            ? '${formatClock(duration)} · LIMITE ${formatClock(max)}'
                            : formatClock(duration),
                        color: tooLong ? colors.brasa : null,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  final String text;
  final Color? color;

  const _Chip({required this.text, this.color});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final background = color ?? colors.scrim.withValues(alpha: 0.55);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadius.sticker),
      ),
      child: Text(
        text,
        style: context.typography.monoMicro.copyWith(
          color: color == null ? colors.textPrimary : colors.onFill(background),
        ),
      ),
    );
  }
}

class _Unreadable extends StatelessWidget {
  final String message;

  const _Unreadable({required this.message});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Center(
      child: AspectRatio(
        aspectRatio: 4 / 5,
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: AppRadius.lgAll,
          ),
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.broken_image_outlined, color: colors.textMuted),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: context.typography.monoMicro.copyWith(
                    color: colors.textMuted,
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
