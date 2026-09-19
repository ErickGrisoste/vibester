import 'dart:async';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/media/media_source.dart';
import 'package:mobile/models/media/picked_media.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/media/camera/app_camera.dart';
import 'package:mobile/widgets/media/media_preview.dart';
import 'package:mobile/widgets/media/media_source_sheet.dart';

import '../helpers/pump_app.dart';

/// Monta [child] como tela cheia no tema pedido, no tamanho pedido.
Future<void> _pumpFullScreen(
  WidgetTester tester,
  Widget child, {
  Size size = TestScreens.medium,
  ThemeMode themeMode = ThemeMode.dark,
}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: themeMode,
      home: Scaffold(body: child),
    ),
  );
  // Entrada da câmera (350ms) + troca de estado (280ms).
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  setUpAll(setUpTestEnvironment);

  /// Cada estado da câmera sem preview, com o que a descoberta devolve para
  /// chegar nele. O estado `ready` precisa de hardware e fica para o QA em
  /// aparelho.
  final estados = <String, Future<List<CameraDescription>> Function()>{
    'carregando': () => Completer<List<CameraDescription>>().future,
    'sem câmera': () async => const [],
    'permissão negada': () async =>
        throw CameraException('CameraAccessDenied', null),
    'permissão bloqueada': () async =>
        throw CameraException('CameraAccessDeniedWithoutPrompt', null),
    'erro ao abrir': () async => throw CameraException('CameraError', null),
  };

  group('AppCamera', () {
    for (final estado in estados.entries) {
      for (final tela in TestScreens.all.entries) {
        for (final tema in [ThemeMode.dark, ThemeMode.light]) {
          testWidgets('${estado.key} renderiza em ${tela.key} (${tema.name})', (
            tester,
          ) async {
            await _pumpFullScreen(
              tester,
              AppCamera(
                onCapture: (_) {},
                onClose: () {},
                onOpenGallery: () {},
                onUseSystemCamera: () {},
                discoverCameras: estado.value,
              ),
              size: tela.value,
              themeMode: tema,
            );
            expect(tester.takeException(), isNull);
            // Nunca tela preta: sempre há como sair.
            expect(find.bySemanticsLabel('Fechar câmera'), findsOneWidget);
          });
        }
      }
    }

    testWidgets('permissão negada oferece pedir de novo e voltar', (
      tester,
    ) async {
      var closed = false;
      await _pumpFullScreen(
        tester,
        AppCamera(
          onCapture: (_) {},
          onClose: () => closed = true,
          discoverCameras: () async =>
              throw CameraException('CameraAccessDenied', null),
        ),
      );

      expect(find.text('Permitir acesso'), findsOneWidget);
      await tester.tap(find.text('Voltar'));
      expect(closed, isTrue);
    });

    testWidgets('permissão bloqueada leva às configurações', (tester) async {
      await _pumpFullScreen(
        tester,
        AppCamera(
          onCapture: (_) {},
          onClose: () {},
          discoverCameras: () async =>
              throw CameraException('CameraAccessDeniedWithoutPrompt', null),
        ),
      );
      expect(find.text('Abrir configurações'), findsOneWidget);
      expect(find.text('CÂMERA DESATIVADA'), findsOneWidget);
    });

    testWidgets('erro oferece a câmera do sistema como reserva', (
      tester,
    ) async {
      var usedSystem = false;
      await _pumpFullScreen(
        tester,
        AppCamera(
          onCapture: (_) {},
          onClose: () {},
          onUseSystemCamera: () => usedSystem = true,
          discoverCameras: () async =>
              throw CameraException('CameraError', null),
        ),
      );
      await tester.tap(find.text('Usar câmera do sistema'));
      expect(usedSystem, isTrue);
    });

    testWidgets('obturador fica desabilitado até a câmera abrir', (
      tester,
    ) async {
      await _pumpFullScreen(
        tester,
        AppCamera(
          onCapture: (_) => fail('não deveria capturar'),
          onClose: () {},
          discoverCameras: () => Completer<List<CameraDescription>>().future,
        ),
      );
      await tester.tap(find.bySemanticsLabel('Tirar foto'));
      await tester.pump();
    });
  });

  group('sheet de origem', () {
    for (final tela in TestScreens.all.entries) {
      testWidgets('renderiza em ${tela.key} e devolve a câmera', (
        tester,
      ) async {
        MediaSource? escolhida;
        await _pumpFullScreen(
          tester,
          Builder(
            builder: (context) => Center(
              child: TextButton(
                onPressed: () async =>
                    escolhida = await showMediaSourceSheet(context),
                child: const Text('abrir'),
              ),
            ),
          ),
          size: tela.value,
        );

        await tester.tap(find.text('abrir'));
        // Um quadro para o ticker da rota começar, outro com ela concluída.
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 600));
        expect(tester.takeException(), isNull);
        expect(find.text('ADICIONAR FOTO'), findsOneWidget);

        await tester.tap(find.text('Câmera'));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 600));
        expect(escolhida, MediaSource.camera);
      });
    }
  });

  group('MediaPreview', () {
    for (final tela in TestScreens.all.entries) {
      testWidgets('renderiza em ${tela.key} mesmo sem conseguir ler a foto', (
        tester,
      ) async {
        await _pumpFullScreen(
          tester,
          MediaPreview(
            items: [PickedMedia.image(XFile('/nao/existe.jpg'))],
            retakeLabel: 'Refazer',
            onRetake: () {},
            onClose: () {},
            onConfirm: () async {},
          ),
          size: tela.value,
        );
        await tester.pump(const Duration(milliseconds: 300));
        expect(tester.takeException(), isNull);
        expect(find.text('Usar foto'), findsOneWidget);
        expect(find.text('Refazer'), findsOneWidget);
      });
    }

    testWidgets('confirmar trava o botão até o processamento terminar', (
      tester,
    ) async {
      final processing = Completer<void>();
      var calls = 0;
      await _pumpFullScreen(
        tester,
        MediaPreview(
          items: [PickedMedia.image(XFile('/nao/existe.jpg'))],
          onClose: () {},
          onConfirm: () {
            calls++;
            return processing.future;
          },
        ),
      );

      await tester.tap(find.text('Usar foto'));
      await tester.pump();
      // Segundo toque durante o processamento não dispara de novo.
      await tester.tap(find.byType(VibesterButton).last, warnIfMissed: false);
      await tester.pump();
      expect(calls, 1);

      processing.complete();
      await tester.pump(const Duration(milliseconds: 300));
      expect(find.text('Usar foto'), findsOneWidget);
    });

    testWidgets('várias fotos mostram posição e permitem tirar uma', (
      tester,
    ) async {
      int? removida;
      await _pumpFullScreen(
        tester,
        MediaPreview(
          items: [
            PickedMedia.image(XFile('/a.jpg')),
            PickedMedia.image(XFile('/b.jpg')),
            PickedMedia.video(XFile('/c.mp4')),
          ],
          confirmLabel: 'Usar fotos',
          onClose: () {},
          onConfirm: () async {},
          onRemove: (i) => removida = i,
        ),
      );
      expect(find.text('1 / 3'), findsOneWidget);
      await tester.tap(find.bySemanticsLabel('Tirar este item'));
      expect(removida, 0);
    });
  });
}
