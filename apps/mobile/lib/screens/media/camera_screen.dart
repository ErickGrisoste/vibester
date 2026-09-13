import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:gal/gal.dart';
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

/// Álbum criado na galeria do aparelho para as capturas do app.
///
/// No Android vira a pasta `Pictures/Vibester` (e `Movies/Vibester` para
/// vídeo); no iOS, um álbum com esse nome no Fotos. O sistema cria sozinho
/// no primeiro salvamento — não há nada a fazer no boot do app.
const _galleryAlbum = 'Vibester';

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

  /// Copia a captura confirmada para a galeria do aparelho, no álbum
  /// `Vibester`, antes de processá-la.
  ///
  /// Vale só para o que a câmera do app gravou: mídia escolhida da galeria
  /// nem passa por aqui, e a captura pela câmera do sistema é pulada porque
  /// vários aparelhos já a gravam sozinhos.
  final bool saveToGallery;

  final Duration maxVideoDuration;
  final CameraLensDirection preferredLens;

  const CameraScreen({
    super.key,
    required this.onConfirm,
    this.review = true,
    this.allowGallery = true,
    this.allowVideo = false,
    this.saveToGallery = true,
    this.maxVideoDuration = const Duration(seconds: 60),
    this.preferredLens = CameraLensDirection.back,
  });

  static Future<CameraOutcome<T>?> open<T>(
    BuildContext context, {
    required CameraConfirm<T> onConfirm,
    bool review = true,
    bool allowGallery = true,
    bool allowVideo = false,
    bool saveToGallery = true,
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
          saveToGallery: saveToGallery,
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

  /// A captura em revisão veio da câmera do sistema (o fallback), não do
  /// `AppCamera`. Nesse caso o app nativo costuma gravar na galeria antes de
  /// devolver o arquivo, e salvar de novo criaria uma cópia duplicada.
  bool _systemCapture = false;

  @override
  void dispose() {
    if (_confirming) MediaProcessor.cancel();
    _progress.dispose();
    super.dispose();
  }

  void _onCapture(PickedMedia media, {bool fromSystemCamera = false}) {
    _systemCapture = fromSystemCamera;
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
    // Antes do `onConfirm`: ele comprime, recorta e apaga o original. O que
    // vai para a galeria é o arquivo em qualidade cheia da câmera.
    await _saveToGallery(media);
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

  /// Copia a captura para o álbum [_galleryAlbum] da galeria.
  ///
  /// Falha aqui nunca interrompe a publicação: sem espaço, sem permissão ou
  /// com formato recusado, a pessoa continua o fluxo e no máximo vê um aviso.
  Future<void> _saveToGallery(PickedMedia media) async {
    if (!widget.saveToGallery || _systemCapture) return;

    try {
      if (!await Gal.hasAccess(toAlbum: true)) {
        // Só o primeiro uso pergunta. Negado, `putImage` lança logo abaixo e
        // cai no `accessDenied` — não vale duplicar a checagem aqui.
        await Gal.requestAccess(toAlbum: true);
      }

      if (media.isVideo) {
        await Gal.putVideo(media.path, album: _galleryAlbum);
      } else {
        await Gal.putImage(media.path, album: _galleryAlbum);
      }
    } on GalException catch (e) {
      debugPrint('Não foi possível salvar na galeria: ${e.type.message}');
      _showError(switch (e.type) {
        GalExceptionType.accessDenied =>
          'Ative o acesso às suas fotos para guardar uma cópia na galeria.',
        GalExceptionType.notEnoughSpace =>
          'Sem espaço no aparelho para guardar uma cópia na galeria.',
        GalExceptionType.notSupportedFormat ||
        GalExceptionType.unexpected =>
          'Não foi possível guardar uma cópia na galeria.',
      });
    } catch (e) {
      // Canal da plataforma quebrado, aparelho sem galeria: segue o fluxo.
      debugPrint('Falha inesperada ao salvar na galeria: $e');
    }
  }

  Future<void> _useSystemCamera() async {
    try {
      final photo = await _picker.captureWithSystemCamera();
      if (photo != null && mounted) {
        _onCapture(photo, fromSystemCamera: true);
      }
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