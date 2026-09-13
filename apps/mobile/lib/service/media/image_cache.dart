import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:mobile/models/media/media_item.dart';

/// Cache de imagem do app — disco e memória, num lugar só.
///
/// Toda foto de rede passa por aqui (via `VibesterImage`). As decisões:
///
/// * **URL de mídia é imutável.** Post, avatar e estabelecimento sobem com
///   chave `.../<uuid>.<ext>` no R2: trocar a foto gera URL nova, nunca
///   sobrescreve a antiga. O R2 não manda `Cache-Control`, e sem ele o
///   `flutter_cache_manager` dá só 7 dias de validade — depois disso, *cada*
///   exibição dispara um download de revalidação em segundo plano. Aqui a
///   validade mínima é [_minValidity].
/// * **Disco com folga.** O padrão guarda 200 arquivos; uma rolada de feed
///   (foto + avatar + capa por post) passa disso e o que foi expulso volta a
///   ser baixado. Aqui são [_maxDiskObjects].
/// * **Memória decodificada no tamanho em que aparece** ([decodeWidth]): um
///   avatar de 36px não ocupa os ~14MB de uma foto 1920px decodificada.
class VibesterImageCache {
  VibesterImageCache._();

  /// Mesma chave do `DefaultCacheManager`: quem atualiza o app reaproveita o
  /// que já estava no disco, em vez de largar um cache órfão para trás.
  static const _cacheKey = 'libCachedImageData';

  static const _minValidity = Duration(days: 30);
  static const _stalePeriod = Duration(days: 60);
  static const _maxDiskObjects = 1500;

  /// Decodificação acima disso não é reduzida: a origem já tem no máximo
  /// 1920px (`ImageSpec.post`), e a imagem grande costuma ser a mesma que
  /// aparece em outra tela (Hero, detalhe) — manter a chave sem redução deixa
  /// as duas compartilharem a mesma entrada de memória.
  static const _fullSizeThreshold = 1024;

  /// Degrau de arredondamento da largura: tamanhos vizinhos (card de 64px e
  /// de 72px) caem na mesma entrada de memória em vez de decodificar duas.
  static const _bucket = 256;

  /// Em `cover`, a foto pode ser mais larga que a caixa (paisagem numa caixa
  /// quadrada ou em pé). Decodificar só a largura da caixa borraria; esta é a
  /// proporção máxima que a decodificação cobre sem perder nitidez.
  static const _maxCoverAspect = 1.5;

  static CacheManager? _manager;

  static CacheManager get manager => _manager ??= _VibesterCacheManager();

  /// Chamado uma vez no boot, antes do primeiro frame.
  static void configureMemoryCache() {
    // Padrão do Flutter é 1000 imagens / 100MB. Com decodificação no tamanho
    // de exibição, miniatura custa pouco: o limite em bytes é o que segura.
    // Abaixo de 200MB, abrir um detalhe com foto grande expulsava as
    // miniaturas do grid do perfil, que "recarregavam" na volta.
    PaintingBinding.instance.imageCache.maximumSize = 600;
    PaintingBinding.instance.imageCache.maximumSizeBytes = 200 << 20;
  }

  /// Largura em pixels físicos para decodificar uma imagem que ocupa uma
  /// caixa de [boxWidth] x [boxHeight] pontos. `null` = decodificar inteira.
  static int? decodeWidth({
    required double boxWidth,
    required double boxHeight,
    required double devicePixelRatio,
    required BoxFit fit,
  }) {
    if (!boxWidth.isFinite || boxWidth <= 0) return null;

    var logical = boxWidth;
    if (fit == BoxFit.cover && boxHeight.isFinite && boxHeight > 0) {
      logical = math.max(boxWidth, boxHeight * _maxCoverAspect);
    } else if (fit != BoxFit.contain &&
        fit != BoxFit.fitWidth &&
        fit != BoxFit.scaleDown) {
      // fill/fitHeight/none: a largura final depende da proporção da origem.
      return null;
    }

    final physical = logical * devicePixelRatio;
    if (physical >= _fullSizeThreshold) return null;
    return (physical / _bucket).ceil() * _bucket;
  }

  /// Deixa [url] no disco sem exibir — para o próximo item do carrossel já
  /// estar local quando o usuário arrastar. Falha é silenciosa: a imagem
  /// ainda carrega normalmente quando aparecer.
  static void warm(String url) {
    if (!url.startsWith('http')) return;
    unawaited(
      manager
          .getSingleFile(url)
          .then<void>(
            (_) {},
            onError: (Object e) {
              debugPrint('Pré-carga de imagem falhou: $e');
            },
          ),
    );
  }

  /// Guarda o arquivo local que acabou de subir sob a URL pública dele: quem
  /// publicou vê a própria foto sem baixar de volta o que acabou de enviar.
  /// Só imagem — vídeo não passa pelo cache de imagem.
  static Future<void> seed(String url, MediaItem item) async {
    if (item.kind != MediaKind.image || !url.startsWith('http')) return;
    try {
      final bytes = await item.file.readAsBytes();
      await manager.putFile(
        url,
        bytes,
        maxAge: _minValidity,
        fileExtension: _extensionFor(item.contentType),
      );
    } catch (e) {
      debugPrint('Não foi possível semear o cache de imagem: $e');
    }
  }

  static String _extensionFor(String contentType) => switch (contentType) {
    'image/png' => 'png',
    'image/webp' => 'webp',
    'image/heic' => 'heic',
    _ => 'jpg',
  };
}

class _VibesterCacheManager extends CacheManager with ImageCacheManager {
  _VibesterCacheManager()
    : super(
        Config(
          VibesterImageCache._cacheKey,
          stalePeriod: VibesterImageCache._stalePeriod,
          maxNrOfCacheObjects: VibesterImageCache._maxDiskObjects,
          fileService: ImmutableMediaFileService(),
        ),
      );
}

/// [HttpFileService] que trata a resposta como conteúdo imutável: validade de
/// pelo menos [minValidity], mesmo sem `Cache-Control` ou com `max-age` curto.
class ImmutableMediaFileService extends FileService {
  final FileService _inner;
  final Duration minValidity;

  ImmutableMediaFileService({
    FileService? inner,
    this.minValidity = VibesterImageCache._minValidity,
  }) : _inner = inner ?? HttpFileService();

  @override
  Future<FileServiceResponse> get(
    String url, {
    Map<String, String>? headers,
  }) async {
    final response = await _inner.get(url, headers: headers);
    return _ImmutableResponse(response, minValidity);
  }
}

class _ImmutableResponse implements FileServiceResponse {
  final FileServiceResponse _inner;
  final Duration _minValidity;
  final DateTime _receivedAt = DateTime.now();

  _ImmutableResponse(this._inner, this._minValidity);

  @override
  DateTime get validTill {
    final floor = _receivedAt.add(_minValidity);
    final server = _inner.validTill;
    return server.isAfter(floor) ? server : floor;
  }

  @override
  Stream<List<int>> get content => _inner.content;

  @override
  int? get contentLength => _inner.contentLength;

  @override
  int get statusCode => _inner.statusCode;

  @override
  String? get eTag => _inner.eTag;

  @override
  String get fileExtension => _inner.fileExtension;
}
