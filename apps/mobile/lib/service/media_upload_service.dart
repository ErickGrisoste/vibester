import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:mobile/models/media/media_item.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';

class UploadUrlResult {
  final String uploadUrl;
  final String key;
  final String publicUrl;
  final String contentType;

  UploadUrlResult({
    required this.uploadUrl,
    required this.key,
    required this.publicUrl,
    required this.contentType,
  });

  factory UploadUrlResult.fromJson(
    Map<String, dynamic> json, {
    required String requestedContentType,
  }) {
    return UploadUrlResult(
      uploadUrl: json['uploadUrl'] ?? '',
      key: json['key'] ?? '',
      publicUrl: json['publicUrl'] ?? '',
      contentType: json['contentType'] ?? requestedContentType,
    );
  }
}

/// Mídia que já está no bucket: a `publicUrl` que vai no `POST /posts` (ou no
/// avatar), o tipo e, em vídeo, a capa.
class UploadedMedia {
  final String url;
  final MediaKind kind;
  final String? thumbnailUrl;

  const UploadedMedia({
    required this.url,
    required this.kind,
    this.thumbnailUrl,
  });

  Map<String, dynamic> toJson() => {
    'url': url,
    'type': kind.apiValue,
    'thumbnailUrl': ?thumbnailUrl,
  };
}

/// Upload direto ao R2 via URL pré-assinada, compartilhado por post e avatar.
///
/// A URL é assinada com o content-type do arquivo: o PUT precisa mandar
/// exatamente o mesmo header, senão o R2 recusa a assinatura (403). Por isso o
/// pedido usa `files` com o tipo real — o formato legado `count` assinava tudo
/// como `image/jpeg`, e qualquer PNG subia com `image/png` e era rejeitado. O
/// content-type vem do [MediaItem], definido por quem gerou o arquivo, e não
/// da extensão.
class MediaUploadService {
  /// O post-service recomenda no máximo 3 PUTs simultâneos: acima disso, em
  /// rede móvel ruim, a banda por arquivo cai e o tempo total não melhora.
  static const _maxParallelUploads = 3;

  /// Limite do `POST /posts/upload-url` por chamada.
  static const _maxFilesPerRequest = 10;

  // Instância separada de propósito: não pode levar o header Authorization
  // da nossa API para um domínio de terceiro. Timeouts próprios porque o
  // corpo é o arquivo inteiro, bem maior que qualquer JSON da API.
  static final Dio _storageDio = Dio(
    BaseOptions(
      connectTimeout: const Duration(seconds: 10),
      sendTimeout: const Duration(seconds: 60),
      receiveTimeout: const Duration(seconds: 30),
    ),
  );

  /// Sobe [items] e devolve as URLs públicas na mesma ordem — a ordem da lista
  /// é a ordem do carrossel. Vídeo sobe junto com a capa, que volta como
  /// `thumbnailUrl` do item.
  Future<List<UploadedMedia>> upload({
    required String userId,
    required List<MediaItem> items,
  }) async {
    if (items.isEmpty) return const [];

    final files = uploadPlan(items);
    final targets = <UploadUrlResult>[];
    for (var start = 0; start < files.length; start += _maxFilesPerRequest) {
      final chunk = files.sublist(
        start,
        math.min(start + _maxFilesPerRequest, files.length),
      );
      final urls = await _getUploadUrls(userId: userId, items: chunk);
      if (urls.length != chunk.length) {
        throw Exception('Erro ao gerar URLs de upload');
      }
      targets.addAll(urls);
    }

    var next = 0;
    Future<void> worker() async {
      while (next < files.length) {
        final i = next++;
        await _uploadToR2(targets[i], files[i]);
      }
    }

    await Future.wait([
      for (var w = 0; w < math.min(_maxParallelUploads, files.length); w++)
        worker(),
    ]);

    var cursor = 0;
    return [
      for (final item in items)
        UploadedMedia(
          url: _normalizeUrl(targets[cursor++].publicUrl),
          kind: item.kind,
          thumbnailUrl: item.thumbnail == null
              ? null
              : _normalizeUrl(targets[cursor++].publicUrl),
        ),
    ];
  }

  /// Arquivos a subir, na ordem em que as URLs são pedidas: cada mídia e,
  /// logo depois dela, a capa (vídeo). [upload] remonta os pares nessa ordem.
  @visibleForTesting
  static List<MediaItem> uploadPlan(List<MediaItem> items) => [
    for (final item in items) ...[item, ?item.thumbnail],
  ];

  Future<List<UploadUrlResult>> _getUploadUrls({
    required String userId,
    required List<MediaItem> items,
  }) async {
    try {
      final response = await ApiClient.dio.post(
        ApiEndpoints.postsUploadUrl(),
        data: {
          'userId': userId,
          'files': [
            for (final item in items)
              {'type': item.kind.apiValue, 'contentType': item.contentType},
          ],
        },
      );
      final List data = response.data;
      return [
        for (var i = 0; i < data.length; i++)
          UploadUrlResult.fromJson(
            data[i],
            requestedContentType: items[i].contentType,
          ),
      ];
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao gerar URLs de upload'));
    }
  }

  Future<void> _uploadToR2(UploadUrlResult target, MediaItem item) async {
    try {
      // Em stream, não em memória: foto comprimida é leve, mas vídeo não.
      final length = await item.file.length();
      await _storageDio.put(
        target.uploadUrl,
        data: item.file.openRead(),
        options: Options(
          sendTimeout: _sendTimeoutFor(length),
          headers: {
            Headers.contentLengthHeader: length,
            Headers.contentTypeHeader: target.contentType,
          },
        ),
      );
    } on DioException catch (e) {
      // O R2 responde XML: a mensagem dele não serve para a tela.
      throw Exception(
        apiErrorMessage(e, 'Não foi possível enviar o arquivo. Tenta de novo.'),
      );
    }
  }

  /// No Dio 5 o `sendTimeout` vale para o corpo inteiro, não para o intervalo
  /// entre pedaços. Um valor fixo derruba arquivo grande em rede fraca; aqui
  /// o limite cresce com o tamanho, supondo pelo menos 64 KB/s (~512 kbps),
  /// com piso de 60s — foto comprimida cabe folgada no piso.
  static Duration _sendTimeoutFor(int bytes) =>
      Duration(seconds: math.max(60, bytes ~/ (64 * 1024)));

  String _normalizeUrl(String url) {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return 'https://$url';
  }
}
