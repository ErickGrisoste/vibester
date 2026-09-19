import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/models/media/picked_media.dart';
import 'package:mobile/service/media/media_failure.dart';

/// Galeria e câmera do sistema, via `image_picker`.
///
/// É a única porta do app para o `image_picker` — telas não o instanciam. A
/// câmera principal é a própria do Vibester (`AppCamera`, pacote `camera`); a
/// do sistema fica como reserva para quando ela não abre no aparelho.
///
/// Não redimensiona nem comprime: o original segue para a prévia e só é
/// processado depois da confirmação, pelo `MediaProcessor` — um lugar só
/// decide resolução e qualidade, e mídia descartada não custa processamento.
class MediaPickerService {
  MediaPickerService({ImagePicker? picker}) : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  /// Abre a galeria. Lista vazia quando a pessoa cancela.
  ///
  /// Com [allowVideo], a galeria mostra fotos e vídeos juntos e cada item
  /// volta com o tipo detectado.
  ///
  /// `requestFullMetadata: false` usa o seletor do sistema sem pedir acesso à
  /// biblioteca inteira no iOS — a pessoa escolhe e o app só enxerga o que foi
  /// escolhido. No Android 13+ o Photo Picker funciona do mesmo jeito.
  Future<List<PickedMedia>> pickFromGallery({
    int maxItems = 1,
    bool allowVideo = false,
  }) async {
    try {
      final List<XFile> files;
      if (maxItems <= 1) {
        final file = allowVideo
            ? await _picker.pickMedia(requestFullMetadata: false)
            : await _picker.pickImage(
                source: ImageSource.gallery,
                requestFullMetadata: false,
              );
        files = file == null ? const [] : [file];
      } else {
        files = allowVideo
            ? await _picker.pickMultipleMedia(
                limit: maxItems,
                requestFullMetadata: false,
              )
            : await _picker.pickMultiImage(
                limit: maxItems,
                requestFullMetadata: false,
              );
      }
      // Android anterior ao 13 não respeita `limit` no seletor.
      return [
        for (final file in files.take(maxItems))
          allowVideo ? PickedMedia.detect(file) : PickedMedia.image(file),
      ];
    } on PlatformException catch (e) {
      throw _fromPlatform(e);
    }
  }

  /// Câmera nativa do sistema — reserva para quando a do app não abre.
  Future<PickedMedia?> captureWithSystemCamera() async {
    try {
      final file = await _picker.pickImage(
        source: ImageSource.camera,
        requestFullMetadata: false,
      );
      return file == null ? null : PickedMedia.image(file);
    } on PlatformException catch (e) {
      throw _fromPlatform(e);
    }
  }

  MediaException _fromPlatform(PlatformException e) {
    switch (e.code) {
      // O iOS só devolve estes quando o acesso já foi negado antes e o
      // sistema não vai mais perguntar.
      case 'photo_access_denied':
        return const MediaException(
          MediaFailure.permissionBlocked,
          'O acesso às suas fotos está desativado.',
        );
      case 'camera_access_denied':
        return const MediaException(
          MediaFailure.permissionBlocked,
          'O acesso à câmera está desativado.',
        );
      case 'no_available_camera':
        return const MediaException(
          MediaFailure.unavailable,
          'Não encontramos uma câmera neste aparelho.',
        );
      default:
        return const MediaException(
          MediaFailure.failed,
          'Não foi possível abrir suas fotos agora.',
        );
    }
  }
}
