import 'package:image_picker/image_picker.dart' show XFile;
import 'package:mobile/models/media/media_item.dart';

/// Mídia recém-escolhida (galeria) ou capturada (câmera), ainda sem
/// processar — o que a prévia mostra e o processador recebe.
///
/// O tipo viaja junto porque a galeria devolve foto e vídeo misturados, e
/// cada um segue um caminho diferente dali em diante (imagem × player,
/// compressão de imagem × de vídeo).
class PickedMedia {
  final XFile file;
  final MediaKind kind;

  const PickedMedia(this.file, this.kind);

  const PickedMedia.image(this.file) : kind = MediaKind.image;

  const PickedMedia.video(this.file) : kind = MediaKind.video;

  /// Descobre o tipo pelo mime (quando a plataforma informa) ou pela
  /// extensão — o seletor do Android costuma não preencher o mime.
  factory PickedMedia.detect(XFile file) {
    final mime = file.mimeType;
    if (mime != null && mime.isNotEmpty) {
      return PickedMedia(
        file,
        mime.startsWith('video/') ? MediaKind.video : MediaKind.image,
      );
    }
    final dot = file.path.lastIndexOf('.');
    final extension = dot < 0 ? '' : file.path.substring(dot + 1).toLowerCase();
    return PickedMedia(
      file,
      _videoExtensions.contains(extension) ? MediaKind.video : MediaKind.image,
    );
  }

  static const _videoExtensions = {
    'mp4',
    'mov',
    'm4v',
    '3gp',
    'webm',
    'mkv',
    'avi',
  };

  String get path => file.path;
  bool get isVideo => kind == MediaKind.video;
}
