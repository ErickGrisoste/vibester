import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/widgets.dart';
import 'package:mobile/service/media/media_failure.dart';

/// Em que pé está a câmera. Um estado só, em vez de `isLoading`,
/// `isCapturing`, `hasError`, `initialized` e `permissionDenied` soltos —
/// combinação impossível (carregando *e* com erro) deixa de existir.
enum CameraStatus {
  /// Pedindo permissão ou abrindo a câmera.
  loading,
  ready,

  /// Tirando a foto ou finalizando o arquivo do vídeo.
  capturing,

  /// Gravando vídeo.
  recording,

  /// Negada agora: dá para pedir de novo.
  permissionDenied,

  /// Negada de vez ou restrita: só os ajustes do aparelho resolvem.
  permissionBlocked,

  /// Nenhuma câmera utilizável no aparelho.
  unavailable,

  /// Falhou ao abrir.
  error,
}

/// Foto ou vídeo.
enum CaptureMode { photo, video }

/// Dona do `CameraController`: inicialização, descarte, troca de lente,
/// flash, zoom, foco, captura, gravação, permissão e ciclo de vida do app.
///
/// Nenhuma tela de negócio fala com o `CameraController` — elas usam o
/// `AppCamera`, que usa isto. É um `ChangeNotifier` local do widget (não um
/// provider global): a câmera só existe enquanto a tela dela está aberta, e
/// o hardware é liberado no `dispose`.
class CameraSession extends ChangeNotifier with WidgetsBindingObserver {
  CameraSession({
    this.preferredLens = CameraLensDirection.back,
    this.resolution = ResolutionPreset.veryHigh,
    this.allowVideo = false,
    Future<List<CameraDescription>> Function()? discoverCameras,
  }) : _discoverCameras = discoverCameras ?? availableCameras;

  /// Libera o modo vídeo. O avatar não usa.
  final bool allowVideo;

  /// Lente usada ao abrir (frontal para avatar, traseira para post).
  final CameraLensDirection preferredLens;

  /// `veryHigh` (~1080p) já entrega a foto no tamanho que o feed usa, então a
  /// captura é rápida e o processamento depois quase não tem o que reduzir.
  final ResolutionPreset resolution;

  final Future<List<CameraDescription>> Function() _discoverCameras;

  CameraController? _controller;
  List<CameraDescription> _cameras = const [];
  CameraDescription? _current;
  CameraStatus _status = CameraStatus.loading;

  CaptureMode _mode = CaptureMode.photo;
  FlashMode _flash = FlashMode.off;
  DateTime? _recordingStartedAt;

  /// O microfone foi negado: vídeo grava sem som, e o controller não pede
  /// áudio de novo nesta sessão.
  bool _audioDenied = false;

  /// Se o controller aberto foi criado com áudio. Foto funciona com ou sem;
  /// só a entrada no modo vídeo exige reabrir.
  bool _controllerHasAudio = false;
  double _zoom = 1;
  double _minZoom = 1;
  double _maxZoom = 1;
  bool _zoomInFlight = false;
  double? _pendingZoom;

  /// Cada abertura ganha um número; resultado de uma abertura antiga (trocou
  /// de lente ou saiu da tela no meio da inicialização) é descartado.
  int _generation = 0;

  /// O Android 11+ trata duas negações seguidas como "não perguntar mais", e
  /// o plugin não distingue esse caso — a contagem faz isso por ele.
  int _consecutiveDenials = 0;

  bool _started = false;
  bool _disposed = false;
  bool _suspended = false;
  bool _awaitingSettings = false;

  CameraStatus get status => _status;

  /// Só existe com a câmera aberta — a UI nunca desenha um controller
  /// descartado ou ainda inicializando.
  CameraController? get controller =>
      _status == CameraStatus.ready ||
          _status == CameraStatus.capturing ||
          _status == CameraStatus.recording
      ? _controller
      : null;

  CaptureMode get mode => _mode;
  bool get isRecording => _status == CameraStatus.recording;

  /// Quando a gravação atual começou — o cronômetro conta daqui.
  DateTime? get recordingStartedAt => _recordingStartedAt;

  /// O vídeo vai sair sem som porque o microfone foi negado.
  bool get audioDenied => _audioDenied;

  bool get isFrontLens => _current?.lensDirection == CameraLensDirection.front;

  bool get canSwitchLens =>
      _current != null &&
      _cameras.any((c) => c.lensDirection != _current!.lensDirection);

  /// Câmera frontal quase nunca tem flash; o botão some nela.
  bool get supportsFlash => !isFrontLens;

  FlashMode get flashMode => _flash;
  double get zoom => _zoom;
  double get minZoom => _minZoom;
  double get maxZoom => _maxZoom;

  Future<void> start() async {
    if (_started) return;
    _started = true;
    WidgetsBinding.instance.addObserver(this);
    await _discoverAndOpen();
  }

  /// Tenta abrir de novo — depois de negação ("Permitir acesso") ou erro.
  Future<void> retry() => _discoverAndOpen();

  /// Leva aos ajustes do aparelho e reabre a câmera sozinha quando a pessoa
  /// voltar.
  Future<void> openSettings() async {
    _awaitingSettings = true;
    await openAppSettings();
  }

  Future<XFile> capture() async {
    final controller = this.controller;
    if (controller == null || _status != CameraStatus.ready) {
      throw const MediaException(
        MediaFailure.failed,
        'A câmera ainda não está pronta.',
      );
    }

    _setStatus(CameraStatus.capturing);
    try {
      return await controller.takePicture();
    } on CameraException catch (e) {
      debugPrint('Falha ao capturar: ${e.code} ${e.description}');
      throw const MediaException(
        MediaFailure.failed,
        'Não deu pra tirar a foto. Tenta de novo.',
      );
    } finally {
      if (_status == CameraStatus.capturing && _controller == controller) {
        _setStatus(CameraStatus.ready);
      }
    }
  }

  Future<void> switchLens() async {
    if (!canSwitchLens || _status != CameraStatus.ready) return;
    _flash = FlashMode.off;
    final target = _cameras.firstWhere(
      (c) => c.lensDirection != _current!.lensDirection,
    );
    await _open(target);
  }

  /// Foto ↔ vídeo. Entrar no vídeo reabre o controller com áudio (e é só aí
  /// que o sistema pede o microfone — quem só tira foto nunca vê o pedido).
  Future<void> setMode(CaptureMode mode) async {
    if (!allowVideo || mode == _mode || _status != CameraStatus.ready) return;
    _mode = mode;
    _flash = FlashMode.off;
    final needsAudio = mode == CaptureMode.video && !_audioDenied;
    if (needsAudio && !_controllerHasAudio && _current != null) {
      await _open(_current!);
      return;
    }
    try {
      await _controller?.setFlashMode(FlashMode.off);
    } on CameraException catch (e) {
      debugPrint('Flash: ${e.code}');
    }
    _notify();
  }

  Future<void> startRecording() async {
    final controller = this.controller;
    if (controller == null ||
        _status != CameraStatus.ready ||
        _mode != CaptureMode.video) {
      return;
    }
    try {
      await controller.startVideoRecording();
      _recordingStartedAt = DateTime.now();
      _setStatus(CameraStatus.recording);
    } on CameraException catch (e) {
      debugPrint('Falha ao gravar: ${e.code} ${e.description}');
      throw const MediaException(
        MediaFailure.failed,
        'Não deu pra começar a gravar. Tenta de novo.',
      );
    }
  }

  Future<XFile> stopRecording() async {
    final controller = _controller;
    if (controller == null || _status != CameraStatus.recording) {
      throw const MediaException(
        MediaFailure.failed,
        'A gravação foi interrompida.',
      );
    }
    _setStatus(CameraStatus.capturing);
    try {
      return await controller.stopVideoRecording();
    } on CameraException catch (e) {
      debugPrint('Falha ao parar gravação: ${e.code} ${e.description}');
      throw const MediaException(
        MediaFailure.failed,
        'A gravação falhou. Tenta de novo.',
      );
    } finally {
      _recordingStartedAt = null;
      if (_status == CameraStatus.capturing && _controller == controller) {
        _setStatus(CameraStatus.ready);
      }
    }
  }

  /// Foto: desligado → automático → sempre. Vídeo: desligado ↔ lanterna.
  Future<void> cycleFlash() async {
    final controller = this.controller;
    if (controller == null || !supportsFlash || isRecording) return;

    final next = _mode == CaptureMode.video
        ? (_flash == FlashMode.torch ? FlashMode.off : FlashMode.torch)
        : switch (_flash) {
            FlashMode.off => FlashMode.auto,
            FlashMode.auto => FlashMode.always,
            _ => FlashMode.off,
          };
    try {
      await controller.setFlashMode(next);
      _flash = next;
      _notify();
    } on CameraException catch (e) {
      debugPrint('Flash indisponível: ${e.code}');
    }
  }

  /// Zoom da pinça. Chega uma chamada por quadro do gesto; só uma vai para o
  /// canal da plataforma por vez, e a mais recente ganha.
  Future<void> setZoom(double value) async {
    final controller = this.controller;
    if (controller == null) return;

    final target = value.clamp(_minZoom, _maxZoom).toDouble();
    if ((target - _zoom).abs() < 0.01) return;
    _zoom = target;
    _notify();

    if (_zoomInFlight) {
      _pendingZoom = target;
      return;
    }
    _zoomInFlight = true;
    try {
      var next = target;
      while (true) {
        await controller.setZoomLevel(next);
        final pending = _pendingZoom;
        _pendingZoom = null;
        if (pending == null || _controller != controller) break;
        next = pending;
      }
    } on CameraException catch (e) {
      debugPrint('Zoom falhou: ${e.code}');
    } finally {
      _zoomInFlight = false;
    }
  }

  /// Foco e exposição no ponto tocado, em coordenadas normalizadas (0–1).
  Future<void> focusAt(Offset point) async {
    final controller = this.controller;
    if (controller == null) return;
    try {
      if (controller.value.focusPointSupported) {
        await controller.setFocusPoint(point);
      }
      if (controller.value.exposurePointSupported) {
        await controller.setExposurePoint(point);
      }
    } on CameraException catch (e) {
      debugPrint('Foco falhou: ${e.code}');
    }
  }

  /// Congela o preview enquanto a foto capturada está em revisão — a câmera
  /// continua aberta para "Refazer" ser imediato, mas sem gastar quadro.
  Future<void> setPreviewPaused(bool paused) async {
    final controller = this.controller;
    if (controller == null) return;
    if (controller.value.isPreviewPaused == paused) return;
    try {
      paused
          ? await controller.pausePreview()
          : await controller.resumePreview();
    } on CameraException catch (e) {
      debugPrint('Pausar preview falhou: ${e.code}');
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    switch (state) {
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        // Durante a inicialização o próprio diálogo de permissão deixa o app
        // `inactive` — derrubar a câmera aí cancelaria o pedido.
        final controller = _controller;
        if (controller == null || !controller.value.isInitialized) return;
        _suspend();
      case AppLifecycleState.resumed:
        if (_suspended) {
          _suspended = false;
          if (_current != null) _open(_current!);
        } else if (_awaitingSettings) {
          _awaitingSettings = false;
          retry();
        }
      case AppLifecycleState.detached:
        break;
    }
  }

  @override
  void dispose() {
    _disposed = true;
    _generation++;
    WidgetsBinding.instance.removeObserver(this);
    final controller = _controller;
    _controller = null;
    controller?.dispose();
    super.dispose();
  }

  /// Libera o hardware com o app em segundo plano; reabre na volta. Uma
  /// gravação em andamento se perde — o arquivo não fecha sem o controller.
  void _suspend() {
    _suspended = true;
    _generation++;
    _recordingStartedAt = null;
    final controller = _controller;
    _controller = null;
    _setStatus(CameraStatus.loading);
    controller?.dispose();
  }

  Future<void> _discoverAndOpen() async {
    _setStatus(CameraStatus.loading);
    try {
      if (_cameras.isEmpty) _cameras = await _discoverCameras();
    } catch (e) {
      if (e is CameraException) {
        _fail(e);
      } else {
        debugPrint('Câmera: $e');
        _setStatus(CameraStatus.error);
      }
      return;
    }
    if (_disposed) return;

    if (_cameras.isEmpty) {
      _setStatus(CameraStatus.unavailable);
      return;
    }

    final lens =
        _current ??
        _cameras.firstWhere(
          (c) => c.lensDirection == preferredLens,
          orElse: () => _cameras.first,
        );
    await _open(lens);
  }

  Future<void> _open(CameraDescription description) async {
    final generation = ++_generation;
    _current = description;

    final previous = _controller;
    _controller = null;
    _setStatus(CameraStatus.loading);
    await previous?.dispose();
    if (_isStale(generation)) return;

    final withAudio = _mode == CaptureMode.video && !_audioDenied;
    final controller = CameraController(
      description,
      resolution,
      // Microfone só no modo vídeo: foto não pede permissão de áudio.
      enableAudio: withAudio,
    );
    _controller = controller;
    _controllerHasAudio = withAudio;

    try {
      await controller.initialize();
      if (_isStale(generation)) {
        await controller.dispose();
        return;
      }

      _minZoom = await controller.getMinZoomLevel();
      _maxZoom = await controller.getMaxZoomLevel();
      _zoom = _minZoom;
      if (!supportsFlash) _flash = FlashMode.off;
      await controller.setFlashMode(_flash);
      // No iOS, preparar a sessão de áudio antes evita o atraso de quase um
      // segundo no primeiro toque em gravar.
      if (_mode == CaptureMode.video) {
        await controller.prepareForVideoRecording();
      }
      if (_isStale(generation)) return;

      _consecutiveDenials = 0;
      _setStatus(CameraStatus.ready);
    } catch (e) {
      // Saiu da tela ou trocou de lente no meio: o que quer que o plugin
      // tenha lançado já não interessa a ninguém.
      if (_isStale(generation)) return;
      _controller = null;
      await controller.dispose();
      if (e is CameraException && _isAudioDenial(e) && withAudio) {
        // Microfone negado: a câmera abre mesmo assim, sem som.
        _audioDenied = true;
        await _open(description);
      } else if (e is CameraException) {
        _fail(e);
      } else {
        debugPrint('Câmera: $e');
        _setStatus(CameraStatus.error);
      }
    }
  }

  bool _isAudioDenial(CameraException e) =>
      e.code == 'AudioAccessDenied' ||
      e.code == 'AudioAccessDeniedWithoutPrompt' ||
      e.code == 'AudioAccessRestricted';

  void _fail(CameraException e) {
    debugPrint('Câmera: ${e.code} ${e.description}');
    switch (e.code) {
      case 'CameraAccessDenied':
        _consecutiveDenials++;
        _setStatus(
          _consecutiveDenials >= 2
              ? CameraStatus.permissionBlocked
              : CameraStatus.permissionDenied,
        );
      case 'CameraAccessDeniedWithoutPrompt':
      case 'CameraAccessRestricted':
        _setStatus(CameraStatus.permissionBlocked);
      default:
        _setStatus(CameraStatus.error);
    }
  }

  bool _isStale(int generation) => _disposed || generation != _generation;

  void _setStatus(CameraStatus status) {
    if (_disposed) return;
    _status = status;
    notifyListeners();
  }

  void _notify() {
    if (!_disposed) notifyListeners();
  }
}
