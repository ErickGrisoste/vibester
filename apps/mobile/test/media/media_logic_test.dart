import 'package:camera/camera.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/models/media/image_spec.dart';
import 'package:mobile/models/media/media_item.dart';
import 'package:mobile/service/media/media_failure.dart';
import 'package:mobile/service/media/media_picker_service.dart';
import 'package:mobile/service/media_upload_service.dart';
import 'package:mobile/widgets/media/camera/camera_session.dart';

/// `ImagePicker` falso: devolve o que o teste mandar, ou lança.
class _FakePicker extends ImagePicker {
  _FakePicker({this.single, this.multi = const [], this.error});

  final XFile? single;
  final List<XFile> multi;
  final PlatformException? error;
  int? lastLimit;

  @override
  Future<XFile?> pickImage({
    required ImageSource source,
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
    CameraDevice preferredCameraDevice = CameraDevice.rear,
    bool requestFullMetadata = true,
  }) async {
    if (error != null) throw error!;
    return single;
  }

  @override
  Future<XFile?> pickMedia({
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
    bool requestFullMetadata = true,
  }) async {
    if (error != null) throw error!;
    return single;
  }

  @override
  Future<List<XFile>> pickMultipleMedia({
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
    int? limit,
    bool requestFullMetadata = true,
  }) async {
    if (error != null) throw error!;
    lastLimit = limit;
    return multi;
  }

  @override
  Future<List<XFile>> pickMultiImage({
    double? maxWidth,
    double? maxHeight,
    int? imageQuality,
    int? limit,
    bool requestFullMetadata = true,
  }) async {
    if (error != null) throw error!;
    lastLimit = limit;
    return multi;
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('contrato de mídia com o post-service', () {
    test('tipo de mídia usa os valores IMAGE/VIDEO do backend', () {
      expect(MediaKind.image.apiValue, 'IMAGE');
      expect(MediaKind.video.apiValue, 'VIDEO');
    });

    test('item de media[] leva url e type', () {
      const uploaded = UploadedMedia(
        url: 'https://bucket/posts/u/a.jpg',
        kind: MediaKind.image,
      );
      expect(uploaded.toJson(), {
        'url': 'https://bucket/posts/u/a.jpg',
        'type': 'IMAGE',
      });
    });

    test('post respeita a referência de 1920px e avatar recorta quadrado', () {
      expect(ImageSpec.post.maxDimension, 1920);
      expect(ImageSpec.post.squareCrop, isFalse);
      expect(ImageSpec.avatar.squareCrop, isTrue);
      expect(
        ImageSpec.avatar.maxDimension,
        lessThan(ImageSpec.post.maxDimension),
      );
    });
  });

  group('MediaPickerService', () {
    test('galeria cancelada devolve lista vazia', () async {
      final service = MediaPickerService(picker: _FakePicker());
      expect(await service.pickFromGallery(), isEmpty);
    });

    test('seleção única devolve a foto escolhida', () async {
      final foto = XFile('/tmp/foto.heic');
      final files = await MediaPickerService(
        picker: _FakePicker(single: foto),
      ).pickFromGallery();
      expect(files.single.path, foto.path);
      expect(files.single.isVideo, isFalse);
    });

    test('galeria com vídeo detecta o tipo de cada item', () async {
      final files = await MediaPickerService(
        picker: _FakePicker(
          multi: [XFile('/tmp/a.jpg'), XFile('/tmp/b.MOV'), XFile('/tmp/c.mp4')],
        ),
      ).pickFromGallery(maxItems: 5, allowVideo: true);
      expect(files.map((f) => f.isVideo), [false, true, true]);
    });

    test('sem vídeo liberado, tudo é tratado como foto', () async {
      final files = await MediaPickerService(
        picker: _FakePicker(multi: [XFile('/tmp/a.jpg'), XFile('/tmp/b.jpg')]),
      ).pickFromGallery(maxItems: 5);
      expect(files.every((f) => !f.isVideo), isTrue);
    });

    test('seleção múltipla respeita o limite mesmo se o seletor não', () async {
      final picker = _FakePicker(
        multi: [for (var i = 0; i < 5; i++) XFile('/tmp/$i.jpg')],
      );
      final files = await MediaPickerService(
        picker: picker,
      ).pickFromGallery(maxItems: 3);
      expect(files, hasLength(3));
      expect(picker.lastLimit, 3);
    });

    test('acesso negado no iOS vira bloqueio (só os ajustes resolvem)', () {
      final service = MediaPickerService(
        picker: _FakePicker(
          error: PlatformException(code: 'photo_access_denied'),
        ),
      );
      expect(
        service.pickFromGallery(),
        throwsA(
          isA<MediaException>().having(
            (e) => e.failure,
            'failure',
            MediaFailure.permissionBlocked,
          ),
        ),
      );
    });

    test('sem câmera no aparelho vira indisponível', () {
      final service = MediaPickerService(
        picker: _FakePicker(
          error: PlatformException(code: 'no_available_camera'),
        ),
      );
      expect(
        service.captureWithSystemCamera(),
        throwsA(
          isA<MediaException>().having(
            (e) => e.failure,
            'failure',
            MediaFailure.unavailable,
          ),
        ),
      );
    });

    test('mensagem da falha é a que vai para a tela', () {
      const e = MediaException(MediaFailure.failed, 'Não deu.');
      expect(e.toString(), 'Não deu.');
    });
  });

  group('CameraSession', () {
    Future<CameraSession> started(
      Future<List<CameraDescription>> Function() discover,
    ) async {
      final session = CameraSession(discoverCameras: discover);
      addTearDown(session.dispose);
      await session.start();
      return session;
    }

    test('aparelho sem câmera fica indisponível, não carregando', () async {
      final session = await started(() async => const []);
      expect(session.status, CameraStatus.unavailable);
      expect(session.controller, isNull);
    });

    test('primeira negação permite pedir de novo', () async {
      final session = await started(
        () async => throw CameraException('CameraAccessDenied', null),
      );
      expect(session.status, CameraStatus.permissionDenied);
    });

    test('segunda negação seguida conta como bloqueio (Android 11+)', () async {
      final session = await started(
        () async => throw CameraException('CameraAccessDenied', null),
      );
      await session.retry();
      expect(session.status, CameraStatus.permissionBlocked);
    });

    test('negada sem prompt (iOS) é bloqueio direto', () async {
      final session = await started(
        () async =>
            throw CameraException('CameraAccessDeniedWithoutPrompt', null),
      );
      expect(session.status, CameraStatus.permissionBlocked);
    });

    test('falha inesperada vira erro, nunca exceção solta', () async {
      final session = await started(
        () async => throw MissingPluginException('sem plugin'),
      );
      expect(session.status, CameraStatus.error);
    });

    test('captura sem câmera pronta falha com mensagem tratada', () async {
      final session = await started(() async => const []);
      expect(session.capture(), throwsA(isA<MediaException>()));
    });

    test('notificar depois do dispose não quebra', () async {
      final session = CameraSession(
        discoverCameras: () async =>
            throw CameraException('CameraAccessDenied', null),
      );
      final pending = session.start();
      session.dispose();
      await pending;
    });
  });
}
