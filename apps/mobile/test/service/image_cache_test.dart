import 'package:flutter/painting.dart';
import 'package:flutter_cache_manager/flutter_cache_manager.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/service/media/image_cache.dart';

void main() {
  group('VibesterImageCache.decodeWidth', () {
    int? decode(
      double w,
      double h, {
      double dpr = 3,
      BoxFit fit = BoxFit.cover,
    }) => VibesterImageCache.decodeWidth(
      boxWidth: w,
      boxHeight: h,
      devicePixelRatio: dpr,
      fit: fit,
    );

    test('avatar pequeno decodifica reduzido, arredondado no degrau', () {
      // 36pt quadrado, cover: max(36, 36*1.5) = 54pt * 3 = 162px → 256.
      expect(decode(36, 36), 256);
    });

    test('tamanhos vizinhos compartilham a mesma entrada de memória', () {
      // Hero de estabelecimento: linha de 72pt → detalhe de 64pt.
      expect(decode(72, 72, dpr: 2), decode(64, 64, dpr: 2));
    });

    test('cover cobre foto mais larga que a caixa', () {
      // Caixa em pé 100x150: precisa de pelo menos a altura * 1.5.
      expect(decode(100, 150, dpr: 1), greaterThanOrEqualTo(225));
    });

    test('imagem grande decodifica inteira', () {
      expect(decode(390, 487), isNull);
    });

    test('caixa sem limite não reduz', () {
      expect(decode(double.infinity, 200), isNull);
      expect(decode(0, 200), isNull);
    });

    test('contain usa só a largura', () {
      expect(decode(100, 900, dpr: 2, fit: BoxFit.contain), 256);
    });

    test('fill não reduz (a largura depende da origem)', () {
      expect(decode(40, 40, fit: BoxFit.fill), isNull);
    });
  });

  group('ImmutableMediaFileService', () {
    test('sem Cache-Control, vale pelo menos a validade mínima', () async {
      final service = ImmutableMediaFileService(
        inner: _FakeFileService(DateTime.now().add(const Duration(days: 7))),
        minValidity: const Duration(days: 30),
      );
      final response = await service.get('https://cdn/x.jpg');
      expect(
        response.validTill.isAfter(
          DateTime.now().add(const Duration(days: 29)),
        ),
        isTrue,
      );
    });

    test('max-age maior que o mínimo é respeitado', () async {
      final far = DateTime.now().add(const Duration(days: 365));
      final service = ImmutableMediaFileService(
        inner: _FakeFileService(far),
        minValidity: const Duration(days: 30),
      );
      final response = await service.get('https://cdn/x.jpg');
      expect(response.validTill, far);
    });
  });
}

class _FakeFileService extends FileService {
  final DateTime validTill;

  _FakeFileService(this.validTill);

  @override
  Future<FileServiceResponse> get(
    String url, {
    Map<String, String>? headers,
  }) async => _FakeResponse(validTill);
}

class _FakeResponse implements FileServiceResponse {
  @override
  final DateTime validTill;

  _FakeResponse(this.validTill);

  @override
  Stream<List<int>> get content => const Stream.empty();

  @override
  int? get contentLength => 0;

  @override
  int get statusCode => 200;

  @override
  String? get eTag => null;

  @override
  String get fileExtension => '.jpg';
}
