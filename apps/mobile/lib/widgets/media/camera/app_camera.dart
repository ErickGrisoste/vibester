import 'dart:async';
import 'dart:math' as math;

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/models/media/picked_media.dart';
import 'package:mobile/service/media/media_failure.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/clock_format.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/media/camera/camera_session.dart';
import 'package:mobile/widgets/media/media_controls.dart';

/// A câmera do Vibester.
///
/// Encapsula preview, permissão, carregamento, erro, flash, troca de lente,
/// zoom na pinça, foco no toque, captura e gravação. Quem usa só recebe a
/// mídia:
///
/// ```dart
/// AppCamera(onCapture: (media) { ... }, onClose: ...)
/// ```
///
/// Sempre no tema escuro, qualquer que seja o do app: preview de câmera
/// precisa de entorno escuro para a pessoa julgar a luz da foto.
class AppCamera extends StatefulWidget {
  final ValueChanged<PickedMedia> onCapture;
  final VoidCallback onClose;

  /// Libera o modo vídeo (seletor FOTO · VÍDEO no topo).
  final bool allowVideo;

  /// A gravação para sozinha aqui.
  final Duration maxVideoDuration;

  /// Mostra o atalho para a galeria ao lado do obturador.
  final VoidCallback? onOpenGallery;

  /// Reserva quando a câmera do app não abre: a câmera nativa do sistema.
  final VoidCallback? onUseSystemCamera;

  final CameraLensDirection preferredLens;

  /// Com `false`, congela o preview (a foto capturada está em revisão por
  /// cima) sem fechar a câmera — "Refazer" volta na hora.
  final bool active;

  /// Substitui a descoberta de câmeras — só para teste.
  @visibleForTesting
  final Future<List<CameraDescription>> Function()? discoverCameras;

  const AppCamera({
    super.key,
    required this.onCapture,
    required this.onClose,
    this.onOpenGallery,
    this.onUseSystemCamera,
    this.allowVideo = false,
    this.maxVideoDuration = const Duration(seconds: 60),
    this.preferredLens = CameraLensDirection.back,
    this.active = true,
    this.discoverCameras,
  });

  @override
  State<AppCamera> createState() => _AppCameraState();
}

class _AppCameraState extends State<AppCamera> with TickerProviderStateMixin {
  late final CameraSession _session;
  late final AnimationController _entrance;
  late final AnimationController _shot;
  bool _entranceStarted = false;

  double _zoomAtGestureStart = 1;
  bool _showZoom = false;
  Timer? _zoomHideTimer;

  Offset? _focusPoint;
  int _focusTick = 0;

  double _lensTurns = 0;

  /// Relógio da gravação: redesenha o cronômetro e para no limite.
  Timer? _recordingTick;
  bool _stopping = false;
  bool _wasRecording = false;
  bool _audioNoticeShown = false;

  @override
  void initState() {
    super.initState();
    _session = CameraSession(
      preferredLens: widget.preferredLens,
      allowVideo: widget.allowVideo,
      discoverCameras: widget.discoverCameras,
    )..addListener(_onSessionChanged);
    _session.start();
    _entrance = AnimationController(
      vsync: this,
      duration: AppMotion.enterDuration,
    );
    _shot = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_entranceStarted) return;
    _entranceStarted = true;
    context.reduceMotion ? _entrance.value = 1 : _entrance.forward();
  }

  @override
  void didUpdateWidget(AppCamera oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.active != widget.active) {
      _session.setPreviewPaused(!widget.active);
    }
  }

  @override
  void dispose() {
    _zoomHideTimer?.cancel();
    _recordingTick?.cancel();
    _session.removeListener(_onSessionChanged);
    _session.dispose();
    _entrance.dispose();
    _shot.dispose();
    super.dispose();
  }

  /// Reage ao que a sessão faz sozinha: gravação começou (liga o relógio),
  /// gravação caiu sem ninguém pedir (app foi para segundo plano), microfone
  /// negado.
  void _onSessionChanged() {
    final recording = _session.isRecording;
    if (recording && _recordingTick == null) {
      _recordingTick = Timer.periodic(
        const Duration(milliseconds: 250),
        (_) => _onRecordingTick(),
      );
    } else if (!recording && _recordingTick != null) {
      _recordingTick!.cancel();
      _recordingTick = null;
    }

    if (_wasRecording && !recording && !_stopping) {
      _notify('A gravação foi interrompida.');
    }
    _wasRecording = recording;

    if (_session.audioDenied && !_audioNoticeShown) {
      _audioNoticeShown = true;
      _notify('Sem acesso ao microfone: o vídeo vai sem som.');
    }
  }

  void _onRecordingTick() {
    if (!mounted) return;
    if (_elapsed >= widget.maxVideoDuration) {
      _stopRecording();
    } else {
      setState(() {});
    }
  }

  Duration get _elapsed {
    final started = _session.recordingStartedAt;
    return started == null ? Duration.zero : DateTime.now().difference(started);
  }

  void _notify(String message) {
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(
      context,
    )?.showSnackBar(SnackBar(content: Text(message)));
  }

  Future<void> _shutter() async {
    if (_session.mode == CaptureMode.video) {
      _session.isRecording ? await _stopRecording() : await _startRecording();
    } else {
      await _capture();
    }
  }

  Future<void> _capture() async {
    HapticFeedback.mediumImpact();
    if (!context.reduceMotion) _shot.forward(from: 0);
    try {
      final photo = await _session.capture();
      if (mounted) widget.onCapture(PickedMedia.image(photo));
    } on MediaException catch (e) {
      _notify(e.message);
    }
  }

  Future<void> _startRecording() async {
    HapticFeedback.mediumImpact();
    try {
      await _session.startRecording();
    } on MediaException catch (e) {
      _notify(e.message);
    }
  }

  Future<void> _stopRecording() async {
    if (_stopping) return;
    _stopping = true;
    HapticFeedback.mediumImpact();
    try {
      final video = await _session.stopRecording();
      if (mounted) widget.onCapture(PickedMedia.video(video));
    } on MediaException catch (e) {
      _notify(e.message);
    } finally {
      _stopping = false;
    }
  }

  void _switchLens() {
    HapticFeedback.selectionClick();
    setState(() => _lensTurns += 0.5);
    _session.switchLens();
  }

  void _onScaleStart(ScaleStartDetails _) {
    _zoomAtGestureStart = _session.zoom;
  }

  void _onScaleUpdate(ScaleUpdateDetails details) {
    if (details.pointerCount < 2) return;
    _session.setZoom(_zoomAtGestureStart * details.scale);
    _zoomHideTimer?.cancel();
    if (!_showZoom) setState(() => _showZoom = true);
  }

  void _onScaleEnd(ScaleEndDetails _) {
    _zoomHideTimer?.cancel();
    _zoomHideTimer = Timer(const Duration(milliseconds: 900), () {
      if (mounted) setState(() => _showZoom = false);
    });
  }

  void _onTapUp(TapUpDetails details, Size box) {
    final local = details.localPosition;
    setState(() {
      _focusPoint = local;
      _focusTick++;
    });
    _session.focusAt(
      Offset(
        (local.dx / box.width).clamp(0.0, 1.0),
        (local.dy / box.height).clamp(0.0, 1.0),
      ),
    );
  }

  /// Entra deslizando de [from] e aparecendo, a partir de [begin] (fração
  /// da animação de entrada) — o quadro chega primeiro, os controles logo
  /// depois.
  Widget _enter(Widget child, {required Offset from, required double begin}) {
    final curved = CurvedAnimation(
      parent: _entrance,
      curve: Interval(begin, 1, curve: AppMotion.enter),
    );
    return FadeTransition(
      opacity: curved,
      child: SlideTransition(
        position: Tween(begin: from, end: Offset.zero).animate(curved),
        child: child,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: AppTheme.dark,
      child: Builder(
        builder: (context) {
          final colors = context.colors;
          return ColoredBox(
            color: colors.noturno,
            child: SafeArea(
              child: ListenableBuilder(
                listenable: _session,
                builder: (context, _) => Column(
                  children: [
                    _enter(
                      _topBar(context),
                      from: const Offset(0, -0.3),
                      begin: 0.15,
                    ),
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.sm),
                        child: FadeTransition(
                          opacity: CurvedAnimation(
                            parent: _entrance,
                            curve: const Interval(
                              0,
                              0.8,
                              curve: AppMotion.enter,
                            ),
                          ),
                          child: ScaleTransition(
                            scale: Tween(begin: 0.96, end: 1.0).animate(
                              CurvedAnimation(
                                parent: _entrance,
                                curve: AppMotion.enter,
                              ),
                            ),
                            child: _viewfinder(context),
                          ),
                        ),
                      ),
                    ),
                    _enter(
                      _controls(context),
                      from: const Offset(0, 0.3),
                      begin: 0.25,
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _topBar(BuildContext context) {
    final showFlash =
        _session.supportsFlash &&
        _session.controller != null &&
        !_session.isRecording;
    final (flashIcon, flashLabel) = switch (_session.flashMode) {
      FlashMode.auto => (Icons.flash_auto_rounded, 'Flash automático'),
      FlashMode.always => (Icons.flash_on_rounded, 'Flash ligado'),
      FlashMode.torch => (Icons.flashlight_on_rounded, 'Luz ligada'),
      _ => (Icons.flash_off_rounded, 'Flash desligado'),
    };

    return Padding(
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
            semanticLabel: 'Fechar câmera',
            onTap: widget.onClose,
          ),
          Expanded(
            child: AnimatedSwitcher(
              duration: context.adaptiveMotion(AppMotion.micro),
              child: _session.isRecording
                  ? _RecordingClock(
                      key: const ValueKey('clock'),
                      elapsed: _elapsed,
                      max: widget.maxVideoDuration,
                    )
                  : widget.allowVideo
                  ? _ModeSwitch(
                      key: const ValueKey('modes'),
                      mode: _session.mode,
                      enabled: _session.status == CameraStatus.ready,
                      onChanged: (mode) {
                        HapticFeedback.selectionClick();
                        _session.setMode(mode);
                      },
                    )
                  : Text(
                      'FOTO',
                      key: const ValueKey('photo'),
                      textAlign: TextAlign.center,
                      style: context.typography.monoEyebrow.copyWith(
                        color: context.colors.textMuted,
                      ),
                    ),
            ),
          ),
          AnimatedSwitcher(
            duration: context.adaptiveMotion(AppMotion.micro),
            child: showFlash
                ? MediaRoundButton(
                    key: ValueKey(_session.flashMode),
                    icon: flashIcon,
                    semanticLabel: '$flashLabel. Toca pra trocar',
                    onTap: _session.cycleFlash,
                  )
                : const SizedBox(width: 48, height: 48),
          ),
        ],
      ),
    );
  }

  Widget _controls(BuildContext context) {
    final status = _session.status;
    final ready = status == CameraStatus.ready;
    final capturing = status == CameraStatus.capturing;
    final recording = status == CameraStatus.recording;
    final video = _session.mode == CaptureMode.video;
    final busy = capturing || recording;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.xl,
        AppSpacing.md,
        AppSpacing.xl,
        AppSpacing.lg,
      ),
      child: Row(
        children: [
          Expanded(
            child: Center(
              child: widget.onOpenGallery == null
                  ? const SizedBox(width: 52, height: 52)
                  : MediaRoundButton(
                      icon: Icons.photo_library_outlined,
                      semanticLabel: 'Escolher da galeria',
                      size: 52,
                      onTap: busy ? null : widget.onOpenGallery,
                    ),
            ),
          ),
          ShutterButton(
            onPressed: (ready || recording) && widget.active ? _shutter : null,
            capturing: capturing,
            video: video,
            recording: recording,
            progress:
                _elapsed.inMilliseconds /
                widget.maxVideoDuration.inMilliseconds,
          ),
          Expanded(
            child: Center(
              child: _session.canSwitchLens
                  ? AnimatedRotation(
                      turns: _lensTurns,
                      duration: context.adaptiveMotion(AppMotion.ui),
                      curve: AppMotion.standard,
                      child: MediaRoundButton(
                        icon: Icons.cameraswitch_outlined,
                        semanticLabel: _session.isFrontLens
                            ? 'Usar câmera traseira'
                            : 'Usar câmera frontal',
                        size: 52,
                        onTap: ready ? _switchLens : null,
                      ),
                    )
                  : const SizedBox(width: 52, height: 52),
            ),
          ),
        ],
      ),
    );
  }

  Widget _viewfinder(BuildContext context) {
    final controller = _session.controller;
    final status = _session.status;

    final (Key key, Widget child) = switch (status) {
      CameraStatus.ready || CameraStatus.capturing when controller != null => (
        const ValueKey('preview'),
        _livePreview(context, controller),
      ),
      CameraStatus.permissionDenied => (
        const ValueKey('denied'),
        _CameraNotice(
          icon: Icons.no_photography_outlined,
          headline: 'Sem acesso à câmera',
          message:
              'Não conseguimos acessar sua câmera. Permite o acesso pra tirar a foto aqui mesmo.',
          primaryLabel: 'Permitir acesso',
          onPrimary: _session.retry,
          secondaryLabel: 'Voltar',
          onSecondary: widget.onClose,
        ),
      ),
      CameraStatus.permissionBlocked => (
        const ValueKey('blocked'),
        _CameraNotice(
          icon: Icons.no_photography_outlined,
          headline: 'Câmera desativada',
          message:
              'O acesso à câmera está desativado. Abre as configurações do aparelho pra permitir.',
          primaryLabel: 'Abrir configurações',
          onPrimary: _session.openSettings,
          secondaryLabel: 'Cancelar',
          onSecondary: widget.onClose,
        ),
      ),
      CameraStatus.unavailable => (
        const ValueKey('unavailable'),
        _CameraNotice(
          icon: Icons.videocam_off_outlined,
          headline: 'Sem câmera',
          message: 'Não encontramos uma câmera utilizável neste aparelho.',
          primaryLabel: widget.onOpenGallery != null
              ? 'Escolher da galeria'
              : 'Voltar',
          onPrimary: widget.onOpenGallery ?? widget.onClose,
          secondaryLabel: widget.onOpenGallery != null ? 'Voltar' : null,
          onSecondary: widget.onClose,
        ),
      ),
      CameraStatus.error => (
        const ValueKey('error'),
        _CameraNotice(
          icon: Icons.error_outline_rounded,
          headline: 'A câmera não abriu',
          message:
              'Pode ser que outro app esteja usando ela. Tenta de novo em instantes.',
          primaryLabel: 'Tentar de novo',
          onPrimary: _session.retry,
          secondaryLabel: widget.onUseSystemCamera != null
              ? 'Usar câmera do sistema'
              : 'Voltar',
          onSecondary: widget.onUseSystemCamera ?? widget.onClose,
          isError: true,
        ),
      ),
      _ => (const ValueKey('loading'), const _CameraLoading()),
    };

    return AnimatedSwitcher(
      duration: context.adaptiveMotion(AppMotion.ui),
      switchInCurve: AppMotion.enter,
      switchOutCurve: AppMotion.exit,
      child: KeyedSubtree(
        key: key,
        child: Center(child: child),
      ),
    );
  }

  Widget _livePreview(BuildContext context, CameraController controller) {
    final colors = context.colors;

    // Micro "respiro" do quadro no disparo: encolhe 3% e volta.
    return AnimatedBuilder(
      animation: _shot,
      builder: (context, child) => Transform.scale(
        scale: 1 - 0.03 * math.sin(math.pi * _shot.value),
        child: child,
      ),
      child: ClipRRect(
        borderRadius: AppRadius.lgAll,
        child: CameraPreview(
          controller,
          child: LayoutBuilder(
            builder: (context, box) => GestureDetector(
              behavior: HitTestBehavior.opaque,
              onScaleStart: _onScaleStart,
              onScaleUpdate: _onScaleUpdate,
              onScaleEnd: _onScaleEnd,
              onTapUp: (d) => _onTapUp(d, box.biggest),
              child: Stack(
                fit: StackFit.expand,
                children: [
                  if (_focusPoint != null)
                    Positioned(
                      left: _focusPoint!.dx - 32,
                      top: _focusPoint!.dy - 32,
                      child: _FocusRing(key: ValueKey(_focusTick)),
                    ),
                  Positioned(
                    left: 0,
                    right: 0,
                    bottom: AppSpacing.md,
                    child: Center(
                      child: AnimatedOpacity(
                        opacity: _showZoom ? 1 : 0,
                        duration: context.adaptiveMotion(AppMotion.micro),
                        child: Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: AppSpacing.md,
                            vertical: AppSpacing.xs,
                          ),
                          decoration: BoxDecoration(
                            color: colors.scrim.withValues(alpha: 0.55),
                            borderRadius: AppRadius.pillAll,
                          ),
                          child: Text(
                            '${_session.zoom.toStringAsFixed(1)}×',
                            style: context.typography.monoSmall.copyWith(
                              color: colors.textPrimary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  // Clarão do obturador.
                  IgnorePointer(
                    child: FadeTransition(
                      opacity: _shotFlash.animate(_shot),
                      child: ColoredBox(color: colors.textPrimary),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

final _shotFlash = TweenSequence<double>([
  TweenSequenceItem(tween: Tween(begin: 0, end: 0.75), weight: 25),
  TweenSequenceItem(
    tween: Tween(
      begin: 0.75,
      end: 0.0,
    ).chain(CurveTween(curve: Curves.easeOut)),
    weight: 75,
  ),
]);

/// Anel de foco: aparece maior, assenta no ponto tocado e some.
class _FocusRing extends StatelessWidget {
  const _FocusRing({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final reduce = context.reduceMotion;

    return IgnorePointer(
      child: TweenAnimationBuilder<double>(
        tween: Tween(begin: 0, end: 1),
        duration: const Duration(milliseconds: 900),
        builder: (context, t, child) {
          final settle = reduce
              ? 1.0
              : Curves.easeOutBack.transform((t / 0.35).clamp(0.0, 1.0));
          final fade = t < 0.7 ? 1.0 : 1 - (t - 0.7) / 0.3;
          return Opacity(
            opacity: fade.clamp(0.0, 1.0),
            child: Transform.scale(scale: 1.3 - 0.3 * settle, child: child),
          );
        },
        child: Container(
          width: 64,
          height: 64,
          decoration: BoxDecoration(
            borderRadius: AppRadius.smAll,
            border: Border.all(color: colors.ambar, width: AppStroke.regular),
          ),
        ),
      ),
    );
  }
}

/// Quadro de espera enquanto a câmera abre — mesma proporção do preview
/// (16:9 em pé) para não haver salto quando a imagem chega.
class _CameraLoading extends StatelessWidget {
  const _CameraLoading();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return AspectRatio(
      aspectRatio: 9 / 16,
      child: ClipRRect(
        borderRadius: AppRadius.lgAll,
        child: DecoratedBox(
          decoration: BoxDecoration(color: colors.surface),
          child: Grain(
            opacity: 0.06,
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: colors.ambar,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    'ABRINDO A CÂMERA',
                    style: context.typography.monoMicro.copyWith(
                      color: colors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Estado sem preview (permissão, sem câmera, erro): o que aconteceu e o que
/// fazer, com até duas saídas. Nunca uma tela preta ou um carregando eterno.
class _CameraNotice extends StatelessWidget {
  final IconData icon;
  final String headline;
  final String message;
  final String primaryLabel;
  final VoidCallback onPrimary;
  final String? secondaryLabel;
  final VoidCallback? onSecondary;
  final bool isError;

  const _CameraNotice({
    required this.icon,
    required this.headline,
    required this.message,
    required this.primaryLabel,
    required this.onPrimary,
    this.secondaryLabel,
    this.onSecondary,
    this.isError = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final accent = isError ? colors.brasa : colors.ambar;

    return DecoratedBox(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.hairline),
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(AppSpacing.xl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 32, color: accent),
            const SizedBox(height: AppSpacing.lg),
            Text(
              headline.toUpperCase(),
              textAlign: TextAlign.center,
              style: type.headlineSmall.copyWith(color: colors.textPrimary),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              message,
              textAlign: TextAlign.center,
              style: type.bodyMedium.copyWith(color: colors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.xl),
            VibesterButton(label: primaryLabel, onPressed: onPrimary),
            if (secondaryLabel != null) ...[
              const SizedBox(height: AppSpacing.sm),
              VibesterButton(
                label: secondaryLabel!,
                variant: VibesterButtonVariant.ghost,
                onPressed: onSecondary,
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// FOTO · VÍDEO — o modo ativo em texto cheio com um ponto âmbar embaixo.
class _ModeSwitch extends StatelessWidget {
  final CaptureMode mode;
  final bool enabled;
  final ValueChanged<CaptureMode> onChanged;

  const _ModeSwitch({
    super.key,
    required this.mode,
    required this.enabled,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        _ModeOption(
          label: 'FOTO',
          selected: mode == CaptureMode.photo,
          onTap: enabled ? () => onChanged(CaptureMode.photo) : null,
        ),
        const SizedBox(width: AppSpacing.xs),
        _ModeOption(
          label: 'VÍDEO',
          selected: mode == CaptureMode.video,
          onTap: enabled ? () => onChanged(CaptureMode.video) : null,
        ),
      ],
    );
  }
}

class _ModeOption extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  const _ModeOption({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final micro = context.adaptiveMotion(AppMotion.micro);

    return Semantics(
      button: true,
      selected: selected,
      label: 'Modo ${label.toLowerCase()}',
      excludeSemantics: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: selected ? null : onTap,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minWidth: 56, minHeight: 44),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              AnimatedDefaultTextStyle(
                duration: micro,
                style: context.typography.monoEyebrow.copyWith(
                  color: selected ? colors.textPrimary : colors.textMuted,
                ),
                child: Text(label),
              ),
              const SizedBox(height: AppSpacing.xs),
              AnimatedContainer(
                duration: micro,
                width: selected ? 4 : 0,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.ambar,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// ● 0:12 / 1:00 — gravando, em `brasa`, com o limite ao lado.
class _RecordingClock extends StatelessWidget {
  final Duration elapsed;
  final Duration max;

  const _RecordingClock({super.key, required this.elapsed, required this.max});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Center(
      child: Semantics(
        liveRegion: true,
        label: 'Gravando, ${elapsed.inSeconds} segundos',
        excludeSemantics: true,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: colors.brasa,
            borderRadius: AppRadius.pillAll,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: colors.onBrasa,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Text(
                '${formatClock(elapsed)} / ${formatClock(max)}',
                style: context.typography.monoSmall.copyWith(
                  color: colors.onBrasa,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
