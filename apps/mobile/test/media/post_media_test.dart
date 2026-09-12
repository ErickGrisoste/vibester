import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/feed/feed_item_model.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/models/media/media_item.dart';
import 'package:mobile/models/media/picked_media.dart';
import 'package:mobile/models/media/post_media.dart';
import 'package:mobile/models/media/video_spec.dart';
import 'package:mobile/service/media_upload_service.dart';
import 'package:mobile/utils/clock_format.dart';
import 'package:mobile/widgets/media/camera/camera_session.dart';

void main() {
  group('PostMedia — leitura de media[]', () {
    test('lê foto e vídeo na ordem, com a capa do vídeo', () {
      final media = PostMedia.listFromJson([
        {'url': 'https://b/a.jpg', 'type': 'IMAGE'},
        {
          'url': 'https://b/v.mp4',
          'type': 'VIDEO',
          'thumbnailUrl': 'https://b/v.jpg',
        },
      ]);

      expect(media.map((m) => m.kind), [MediaKind.image, MediaKind.video]);
      expect(media.last.thumbnailUrl, 'https://b/v.jpg');
      expect(media.first.coverUrl, 'https://b/a.jpg');
      expect(media.last.coverUrl, 'https://b/v.jpg');
    });

    test('post antigo sem media cai para a lista legada, tudo foto', () {
      final media = PostMedia.listFromJson(
        null,
        legacyImageUrls: ['https://b/a.jpg', 'https://b/b.jpg'],
      );
      expect(media, hasLength(2));
      expect(media.every((m) => !m.isVideo), isTrue);
    });

    test('media vazia também cai para o legado', () {
      final media = PostMedia.listFromJson(
        const [],
        legacyImageUrls: ['https://b/a.jpg'],
      );
      expect(media.single.url, 'https://b/a.jpg');
    });

    test('item sem url é ignorado em vez de virar placeholder quebrado', () {
      final media = PostMedia.listFromJson([
        {'url': '', 'type': 'IMAGE'},
        {'type': 'VIDEO'},
        {'url': 'https://b/a.jpg', 'type': 'IMAGE'},
      ]);
      expect(media.single.url, 'https://b/a.jpg');
    });

    test('vídeo sem capa não inventa uma', () {
      final media = PostMedia.fromJson({
        'url': 'https://b/v.mp4',
        'type': 'VIDEO',
        'thumbnailUrl': '',
      });
      expect(media.thumbnailUrl, isNull);
      expect(media.coverUrl, isEmpty);
    });

    test('tipo desconhecido é tratado como foto', () {
      expect(MediaKind.fromApi('GIF'), MediaKind.image);
      expect(MediaKind.fromApi(null), MediaKind.image);
    });
  });

  group('modelos que leem media', () {
    test('feed lê media em camelCase no meio do payload snake_case', () {
      final item = FeedItemModel.fromJson({
        'item_id': 'p1',
        'item_type': 'USER_POST',
        'image_urls': ['https://b/a.jpg'],
        'media': [
          {'url': 'https://b/a.jpg', 'type': 'IMAGE'},
          {
            'url': 'https://b/v.mp4',
            'type': 'VIDEO',
            'thumbnailUrl': 'https://b/v.jpg',
          },
        ],
      });

      expect(item.media, hasLength(2));
      final publication = PublicationModel.fromFeedItem(item);
      expect(publication.media, hasLength(2));
      expect(publication.publicationImage, 'https://b/a.jpg');
    });

    test('post só de vídeo usa a capa como imagem do card', () {
      final publication = PublicationModel.fromFeedItem(
        FeedItemModel.fromJson({
          'item_id': 'p1',
          'image_urls': <String>[],
          'media': [
            {
              'url': 'https://b/v.mp4',
              'type': 'VIDEO',
              'thumbnailUrl': 'https://b/v.jpg',
            },
          ],
        }),
      );
      expect(publication.publicationImage, 'https://b/v.jpg');
    });

    test('grade do perfil usa a capa e sabe que há vídeo', () {
      final highlight = HighlightModel.fromJson({
        'postId': 'p1',
        'imageUrls': <String>[],
        'media': [
          {
            'url': 'https://b/v.mp4',
            'type': 'VIDEO',
            'thumbnailUrl': 'https://b/v.jpg',
          },
        ],
      });
      expect(highlight.imagemEmDestaque, 'https://b/v.jpg');
      expect(highlight.temVideo, isTrue);
      expect(highlight.copyWith(totalCurtidas: 3).midias, hasLength(1));
    });
  });

  group('upload', () {
    final foto = MediaItem.jpeg(File('/tmp/a.jpg'));
    final capa = MediaItem.jpeg(File('/tmp/v.jpg'));
    final video = MediaItem.mp4(File('/tmp/v.mp4'), thumbnail: capa);

    test('vídeo sobe logo seguido da capa, na ordem do carrossel', () {
      final plan = MediaUploadService.uploadPlan([foto, video]);
      expect(plan.map((m) => m.path), ['/tmp/a.jpg', '/tmp/v.mp4', '/tmp/v.jpg']);
    });

    test('vídeo declara video/mp4 e a capa image/jpeg', () {
      expect(video.contentType, 'video/mp4');
      expect(video.kind.apiValue, 'VIDEO');
      expect(video.thumbnail!.contentType, 'image/jpeg');
      expect(video.coverPath, '/tmp/v.jpg');
    });

    test('item de vídeo leva thumbnailUrl; foto não leva a chave', () {
      expect(
        const UploadedMedia(
          url: 'https://b/v.mp4',
          kind: MediaKind.video,
          thumbnailUrl: 'https://b/v.jpg',
        ).toJson(),
        {
          'url': 'https://b/v.mp4',
          'type': 'VIDEO',
          'thumbnailUrl': 'https://b/v.jpg',
        },
      );
      expect(
        const UploadedMedia(
          url: 'https://b/a.jpg',
          kind: MediaKind.image,
        ).toJson().containsKey('thumbnailUrl'),
        isFalse,
      );
    });
  });

  group('PickedMedia.detect', () {
    test('usa o mime quando a plataforma informa', () {
      expect(
        PickedMedia.detect(XFile('/tmp/sem_extensao', mimeType: 'video/mp4'))
            .isVideo,
        isTrue,
      );
      expect(
        PickedMedia.detect(XFile('/tmp/a.mp4', mimeType: 'image/jpeg')).isVideo,
        isFalse,
      );
    });

    test('cai para a extensão, sem diferenciar maiúscula', () {
      expect(PickedMedia.detect(XFile('/tmp/IMG_1.MOV')).isVideo, isTrue);
      expect(PickedMedia.detect(XFile('/tmp/IMG_1.HEIC')).isVideo, isFalse);
      expect(PickedMedia.detect(XFile('/tmp/sem_extensao')).isVideo, isFalse);
    });
  });

  test('limite de vídeo do post é 1 minuto', () {
    expect(VideoSpec.post.maxDuration, const Duration(minutes: 1));
  });

  test('relógio de duração', () {
    expect(formatClock(const Duration(seconds: 42)), '0:42');
    expect(formatClock(const Duration(seconds: 65)), '1:05');
    expect(formatClock(Duration.zero), '0:00');
  });

  group('CameraSession — vídeo', () {
    test('modo vídeo só existe quando liberado', () async {
      final session = CameraSession(discoverCameras: () async => const []);
      addTearDown(session.dispose);
      await session.start();
      await session.setMode(CaptureMode.video);
      expect(session.mode, CaptureMode.photo);
    });

    test('gravar sem câmera pronta não faz nada', () async {
      final session = CameraSession(
        allowVideo: true,
        discoverCameras: () async => const [],
      );
      addTearDown(session.dispose);
      await session.start();
      await session.startRecording();
      expect(session.isRecording, isFalse);
      expect(session.recordingStartedAt, isNull);
    });
  });
}
