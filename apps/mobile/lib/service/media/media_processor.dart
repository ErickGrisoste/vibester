import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart' show Color;
import 'package:flutter_image_compress/flutter_image_compress.dart';
import 'package:image_cropper/image_cropper.dart';
import 'package:mobile/models/media/image_spec.dart';
import 'package:mobile/models/media/media_item.dart';
import 'package:mobile/models/media/picked_media.dart';
import 'package:mobile/models/media/video_spec.dart';
import 'package:mobile/service/media/media_failure.dart';
import 'package:mobile/utils/clock_format.dart';
import 'package:video_compress/video_compress.dart';

/// Cores e textos da tela nativa de recorte.
///
/// O recorte roda em tela nativa (uCrop no Android, TOCropViewController no
/// iOS); o tema chega aqui por parâmetro para o service não depender de
/// `BuildContext`.
class CropAppearance {
  final String title;
  final Color background;
  final Color foreground;
  final Color accent;
  final Color dim;

  const CropAppearance({
    required this.title,
    required this.background,
    required this.foreground,
    required this.accent,
    required this.dim,
  });
}

/// Etapa entre "a pessoa confirmou" e "sobe para o R2".
///
/// **Imagem** sai em JPEG, girada de acordo com o EXIF, sem metadado nenhum
/// (a localização GPS que a câmera grava não vai parar num post público) e
/// limitada pela maior dimensão do [ImageSpec]. Sair sempre em JPEG também
/// elimina o descompasso de content-type: PNG, HEIC e WebP da galeria viram o
/// mesmo formato, assinado e enviado como `image/jpeg`.
///
/// **Vídeo** é validado pela duração do [VideoSpec], recomprimido em MP4 720p
/// e ganha uma capa (primeiro quadro, processada como imagem) — é ela que
/// vira o `thumbnailUrl` que o feed mostra antes do play.
class MediaProcessor {
  const MediaProcessor();

  static int _sequence = 0;

  /// Arquivos gerados aqui. Só estes podem ser apagados por [discard] — nunca
  /// um original da galeria.
  static final Set<String> _owned = {};

  /// Processa uma lista em sequência, preservando a ordem. Em paralelo, várias
  /// fotos de 12MP decodificadas ao mesmo tempo estouram memória em Android
  /// modesto, e o compressor de vídeo só atende um arquivo por vez.
  ///
  /// [onProgress] recebe de 0 a 1 considerando a lista inteira — vídeo é a
  /// parte lenta, e é ali que a barra anda de verdade.
  Future<List<MediaItem>> processAll(
    List<PickedMedia> sources, {
    ImageSpec imageSpec = ImageSpec.post,
    VideoSpec videoSpec = VideoSpec.post,
    bool deleteSources = false,
    ValueChanged<double>? onProgress,
  }) async {
    final items = <MediaItem>[];
    final share = 1 / math.max(1, sources.length);
    for (var i = 0; i < sources.length; i++) {
      final source = sources[i];
      final base = i * share;
      onProgress?.call(base);
      items.add(
        source.isVideo
            ? await processVideo(
                source.file,
                videoSpec,
                deleteSource: deleteSources,
                onProgress: onProgress == null
                    ? null
                    : (p) => onProgress(base + p * share),
              )
            : await processImage(
                source.file,
                imageSpec,
                deleteSource: deleteSources,
              ),
      );
    }
    onProgress?.call(1);
    return items;
  }

  /// Processa uma imagem. Com [deleteSource], apaga o arquivo de origem
  /// depois — use só para arquivos temporários do próprio app (captura da
  /// câmera, saída do recorte), nunca para o que veio da galeria.
  Future<MediaItem> processImage(
    XFile source,
    ImageSpec spec, {
    bool deleteSource = false,
  }) async {
    final shortSide = await _targetShortSide(source.path, spec.maxDimension);
    final target = await _newTempPath('jpg');

    XFile? output;
    try {
      // O compressor não limita a maior dimensão: ele encaixa o *menor* lado
      // no valor pedido (e nunca amplia). Passar o mesmo valor nos dois eixos
      // e calculá-lo a partir da proporção real resolve isso sem depender da
      // orientação EXIF.
      output = await FlutterImageCompress.compressAndGetFile(
        source.path,
        target,
        minWidth: shortSide,
        minHeight: shortSide,
        quality: spec.quality,
        format: CompressFormat.jpeg,
        autoCorrectionAngle: true,
        keepExif: false,
      );
    } catch (e) {
      debugPrint('Falha ao comprimir imagem: $e');
    }

    if (output == null) {
      // A origem fica: a prévia ainda mostra ela, e a pessoa pode tentar de
      // novo ou refazer.
      throw const MediaException(
        MediaFailure.failed,
        'Não foi possível preparar a foto. Tenta com outra.',
      );
    }
    _owned.add(output.path);
    if (deleteSource) _deleteQuietly(source.path);
    return MediaItem.jpeg(File(output.path));
  }

  /// Valida a duração, recomprime e gera a capa.
  Future<MediaItem> processVideo(
    XFile source,
    VideoSpec spec, {
    bool deleteSource = false,
    ValueChanged<double>? onProgress,
  }) async {
    final duration = await _durationOf(source.path);
    // Meio segundo de folga: a câmera para no limite, mas o arquivo pode
    // sair com alguns quadros a mais.
    if (duration != null &&
        duration > spec.maxDuration + const Duration(milliseconds: 500)) {
      throw MediaException(
        MediaFailure.tooLong,
        'Vídeos de até ${formatClock(spec.maxDuration)}. '
        'Esse tem ${formatClock(duration)}.',
      );
    }

    final subscription = onProgress == null
        ? null
        : VideoCompress.compressProgress$.subscribe(
            (percent) => onProgress((percent / 100).clamp(0.0, 1.0)),
          );

    MediaInfo? compressed;
    try {
      compressed = await VideoCompress.compressVideo(
        source.path,
        quality: VideoQuality.Res1280x720Quality,
        includeAudio: true,
      );
    } catch (e) {
      debugPrint('Falha ao comprimir vídeo: $e');
    } finally {
      subscription?.unsubscribe();
    }

    if (compressed?.isCancel ?? false) {
      throw const MediaException(MediaFailure.cancelled, 'Cancelado.');
    }
    final path = compressed?.path;
    if (path == null || !File(path).existsSync()) {
      throw const MediaException(
        MediaFailure.failed,
        'Não foi possível preparar o vídeo. Tenta com outro.',
      );
    }
    _owned.add(path);

    final MediaItem cover;
    try {
      final frame = await VideoCompress.getFileThumbnail(path, quality: 95);
      cover = await processImage(
        XFile(frame.path),
        ImageSpec.post,
        deleteSource: true,
      );
    } catch (e) {
      debugPrint('Falha ao gerar capa: $e');
      _deleteQuietly(path);
      throw const MediaException(
        MediaFailure.failed,
        'Não foi possível preparar o vídeo. Tenta com outro.',
      );
    }

    if (deleteSource) _deleteQuietly(source.path);
    return MediaItem.mp4(
      File(path),
      thumbnail: cover,
      duration: duration ?? compressed?.durationValue,
    );
  }

  /// Interrompe a compressão de vídeo em andamento (a pessoa saiu da prévia).
  static Future<void> cancel() async {
    if (VideoCompress.isCompressing) await VideoCompress.cancelCompression();
  }

  /// Recorte quadrado (avatar). `null` quando a pessoa cancela.
  ///
  /// Sai em qualidade máxima e já no tamanho final: a única compressão com
  /// perda é a do [processImage] que vem depois, que também remove o EXIF que
  /// o uCrop copia do original (inclusive GPS).
  Future<XFile?> cropSquare(
    XFile source,
    ImageSpec spec,
    CropAppearance appearance,
  ) async {
    try {
      final cropped = await ImageCropper().cropImage(
        sourcePath: source.path,
        maxWidth: spec.maxDimension,
        maxHeight: spec.maxDimension,
        aspectRatio: const CropAspectRatio(ratioX: 1, ratioY: 1),
        compressFormat: ImageCompressFormat.jpg,
        compressQuality: 100,
        uiSettings: [
          AndroidUiSettings(
            toolbarTitle: appearance.title,
            toolbarColor: appearance.background,
            toolbarWidgetColor: appearance.foreground,
            statusBarLight: false,
            navBarLight: false,
            backgroundColor: appearance.background,
            activeControlsWidgetColor: appearance.accent,
            dimmedLayerColor: appearance.dim,
            cropFrameColor: appearance.accent,
            cropGridColor: appearance.foreground.withValues(alpha: 0.25),
            showCropGrid: true,
            lockAspectRatio: true,
            hideBottomControls: true,
            initAspectRatio: CropAspectRatioPreset.square,
            aspectRatioPresets: const [CropAspectRatioPreset.square],
          ),
          IOSUiSettings(
            title: appearance.title,
            doneButtonTitle: 'Usar',
            cancelButtonTitle: 'Cancelar',
            aspectRatioLockEnabled: true,
            resetAspectRatioEnabled: false,
            aspectRatioPickerButtonHidden: true,
            aspectRatioPresets: const [CropAspectRatioPreset.square],
          ),
        ],
      );
      return cropped == null ? null : XFile(cropped.path);
    } catch (e) {
      debugPrint('Falha ao recortar imagem: $e');
      throw const MediaException(
        MediaFailure.failed,
        'Não foi possível abrir o ajuste da foto.',
      );
    }
  }

  /// Apaga os arquivos que este processador gerou para [item] (a mídia e a
  /// capa). Chamado quando a mídia já subiu ou foi descartada — o sistema
  /// limparia a pasta temporária em algum momento, mas vídeo pesa.
  static void discard(MediaItem item) {
    for (final path in [item.path, ?item.thumbnail?.path]) {
      if (_owned.remove(path)) _deleteQuietly(path);
    }
  }

  /// Menor lado de destino para que o maior fique em [maxDimension].
  ///
  /// Lê só o cabeçalho do arquivo (`ImageDescriptor`), sem decodificar os
  /// pixels. Se o formato não for legível pelo Flutter (HEIC em aparelho
  /// antigo), cai para limitar o menor lado — ainda reduz, só que menos.
  Future<int> _targetShortSide(String path, int maxDimension) async {
    try {
      final buffer = await ui.ImmutableBuffer.fromFilePath(path);
      final descriptor = await ui.ImageDescriptor.encoded(buffer);
      final longSide = math.max(descriptor.width, descriptor.height);
      final shortSide = math.min(descriptor.width, descriptor.height);
      descriptor.dispose();
      buffer.dispose();

      if (longSide <= maxDimension) return shortSide;
      return math.max(1, (maxDimension * shortSide / longSide).floor());
    } catch (_) {
      return maxDimension;
    }
  }

  Future<Duration?> _durationOf(String path) async {
    try {
      return (await VideoCompress.getMediaInfo(path)).durationValue;
    } catch (e) {
      debugPrint('Falha ao ler duração do vídeo: $e');
      return null;
    }
  }

  static String get _tempDirPath =>
      '${Directory.systemTemp.path}${Platform.pathSeparator}vibester_media';

  Future<String> _newTempPath(String extension) async {
    final dir = Directory(_tempDirPath);
    if (!await dir.exists()) await dir.create(recursive: true);
    final name =
        '${DateTime.now().microsecondsSinceEpoch}_${_sequence++}.$extension';
    return '${dir.path}${Platform.pathSeparator}$name';
  }

  static void _deleteQuietly(String path) {
    File(path).delete().catchError((_) => File(path));
  }
}

extension on MediaInfo {
  Duration? get durationValue {
    final ms = duration;
    return ms == null || ms <= 0 ? null : Duration(milliseconds: ms.round());
  }
}
