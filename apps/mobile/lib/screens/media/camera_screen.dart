import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/models/media/picked_media.dart';
import 'package:mobile/service/media/media_failure.dart';
import 'package:mobile/service/media/media_picker_service.dart';
import 'package:mobile/service/media/media_processor.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/theme/vibester_page_route.dart';
import 'package:mobile/widgets/media/camera/app_camera.dart';
import 'package:mobile/widgets/media/media_preview.dart';

/// Como a tela de câmera terminou.
sealed class CameraOutcome<T> {
  const CameraOutcome();
}

/// Mídia capturada, confirmada e transformada no resultado do fluxo.
final class CameraDone<T> extends CameraOutcome<T> {
  final T value;
  const CameraDone(this.value);
}

/// A pessoa tocou em "galeria" dentro da câmera.
final class CameraGalleryRequested<T> extends CameraOutcome<T> {
  const CameraGalleryRequested();
}

/// Recebe a captura confirmada e informa o progresso do processamento.
typedef CameraConfirm<T> =
    Future<T?> Function(PickedMedia media, ValueChanged<double> onProgress);

/// Tela cheia de câmera: `AppCamera` e, por cima dela, a revisão da captura.
///
/// Não sabe o que é post nem avatar: [onConfirm] transforma a captura
/// confirmada no resultado (processar, recortar...). Quando ele devolve
/// `null` — recorte cancelado, por exemplo — a câmera continua aberta para
/// outra tentativa, em vez de jogar a pessoa para fora do fluxo.
class CameraScreen<T> extends StatefulWidget {
  final CameraConfirm<T> onConfirm;

  /// Mostra a captura para confirmar ("Usar"/"Refazer") antes de
  /// [onConfirm]. O avatar dispensa: o recorte já é a revisão.
  final bool review;

  final bool allowGallery;
  final bool allowVideo;
  final Duration maxVideoDuration;
  final CameraLensDirection preferredLens;

  const CameraScreen({
    super.key,
    required this.onConfirm,
    this.review = true,
    this.allowGallery = true,
    this.allowVideo = false,
    this.maxVideoDuration = const Duration(seconds: 60),
    this.preferredLens = CameraLensDirection.back,
  });

  static Future<CameraOutcome<T>?> open<T>(
    BuildContext context, {
    required CameraConfirm<T> onConfirm,
    bool review = true,
    bool allowGallery = true,
    bool allowVideo = false,
    Duration maxVideoDuration = const Duration(seconds: 60),
    CameraLensDirection preferredLens = CameraLensDirection.back,
  }) async {
    final result = await Navigator.of(context).push(
      vibesterFadeRoute(
        CameraScreen<T>(
          onConfirm: onConfirm,
          review: review,
          allowGallery: allowGallery,
          allowVideo: allowVideo,
          maxVideoDuration: maxVideoDuration,
          preferredLens: preferredLens,
        ),
        const RouteSettings(name: 'camera'),
      ),
    );
    return result as CameraOutcome<T>?;
  }

  @override
  State<CameraScreen<T>> createState() => _CameraScreenState<T>();
}

class _CameraScreenState<T> extends State<CameraScreen<T>> {
  final _picker = MediaPickerService();
  final _progress = ValueNotifier<double?>(null);

  PickedMedia? _review;
  bool _confirming = false;

  @override
  void dispose() {
    if (_confirming) MediaProcessor.cancel();
    _progress.dispose();
    super.dispose();
  }

  void _onCapture(PickedMedia media) {
    if (widget.review) {
      setState(() => _review = media);
    } else {
      _confirm(media);
    }
  }

  void _retake() {
    final media = _review;
    if (_confirming) MediaProcessor.cancel();
    setState(() => _review = null);
    // Captura descartada: é arquivo temporário da câmera, não da galeria.
    if (media != null) File(media.path).delete().ignore();
  }

  Future<void> _confirm(PickedMedia media) async {
    if (_confirming) return;
    setState(() => _confirming = true);
    _progress.value = media.isVideo ? 0 : null;
    try {
      final value = await widget.onConfirm(
        media,
        (p) => _progress.value = media.isVideo ? p : null,
      );
      if (!mounted) return;
      if (value != null) {
        Navigator.of(context).pop(CameraDone<T>(value));
        return;
      }
      setState(() => _review = null);
    } on MediaException catch (e) {
      if (e.failure != MediaFailure.cancelled) _showError(e.message);
    } finally {
      _progress.value = null;
      if (mounted) setState(() => _confirming = false);
    }
  }

  Future<void> _useSystemCamera() async {
    try {
      final photo = await _picker.captureWithSystemCamera();
      if (photo != null && mounted) _onCapture(photo);
    } on MediaException catch (e) {
      _showError(e.message);
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    final review = _review;

    // Tema escuro na tela inteira, não só no `AppCamera`: os avisos
    // (SnackBar) aparecem sobre o preview e precisam do mesmo contraste.
    return Theme(
      data: AppTheme.dark,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: Builder(
          builder: (context) => Scaffold(
            backgroundColor: context.colors.noturno,
            body: Stack(
              fit: StackFit.expand,
              children: [
                AppCamera(
                  preferredLens: widget.preferredLens,
                  allowVideo: widget.allowVideo,
                  maxVideoDuration: widget.maxVideoDuration,
                  active: review == null && !_confirming,
                  onCapture: _onCapture,
                  onClose: () => Navigator.of(context).maybePop(),
                  onOpenGallery: widget.allowGallery
                      ? () => Navigator.of(
                          context,
                        ).pop(CameraGalleryRequested<T>())
                      : null,
                  onUseSystemCamera: _useSystemCamera,
                ),
                AnimatedSwitcher(
                  duration: context.adaptiveMotion(AppMotion.ui),
                  switchInCurve: AppMotion.enter,
                  switchOutCurve: AppMotion.exit,
                  child: review == null
                      ? const SizedBox.shrink()
                      : MediaPreview(
                          key: ValueKey(review.path),
                          items: [review],
                          confirmLabel: review.isVideo
                              ? 'Usar vídeo'
                              : 'Usar foto',
                          retakeLabel: 'Refazer',
                          onRetake: _retake,
                          onClose: _retake,
                          progress: _progress,
                          maxVideoDuration: widget.maxVideoDuration,
                          onConfirm: () => _confirm(review),
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
