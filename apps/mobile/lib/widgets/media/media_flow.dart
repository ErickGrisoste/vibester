import 'dart:io';

import 'package:camera/camera.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/media/image_spec.dart';
import 'package:mobile/models/media/media_item.dart';
import 'package:mobile/models/media/media_source.dart';
import 'package:mobile/models/media/picked_media.dart';
import 'package:mobile/models/media/video_spec.dart';
import 'package:mobile/screens/media/camera_screen.dart';
import 'package:mobile/screens/media/media_preview_screen.dart';
import 'package:mobile/service/media/media_processor.dart';
import 'package:mobile/service/media/media_failure.dart';
import 'package:mobile/service/media/media_picker_service.dart';
import 'package:mobile/theme/app_colors.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/media/media_source_sheet.dart';

/// Ponto único de entrada para foto e vídeo no app.
///
/// Post e perfil chamam isto e recebem mídia pronta para subir — já
/// processada, com content-type certo. Nenhum dos dois conhece câmera,
/// galeria, recorte, compressão ou permissão:
///
/// ```text
/// origem (sheet) ─┬─ câmera ── revisão ─┐
///                 └─ galeria ── prévia ─┴─ [recorte] ─ processamento ─▶ MediaItem
/// ```
///
/// Nada sobe para o backend aqui: o upload é de quem recebe o resultado, na
/// hora em que a pessoa publica/salva.
class MediaFlow {
  MediaFlow._();

  static final _picker = MediaPickerService();
  static const _processor = MediaProcessor();

  /// Mídia de post: fotos e, com [allowVideo], vídeos. Lista vazia se a
  /// pessoa desistir em qualquer ponto.
  static Future<List<MediaItem>> pickMedia(
    BuildContext context, {
    int maxItems = 1,
    bool allowVideo = true,
    ImageSpec imageSpec = ImageSpec.post,
    VideoSpec videoSpec = VideoSpec.post,
    String title = 'Adicionar ao post',
  }) async {
    if (maxItems < 1) return const [];
    var source = await showMediaSourceSheet(context, title: title);

    while (source != null) {
      if (!context.mounted) return const [];
      switch (source) {
        case MediaSource.camera:
          final outcome = await CameraScreen.open<List<MediaItem>>(
            context,
            allowVideo: allowVideo,
            maxVideoDuration: videoSpec.maxDuration,
            // A captura é arquivo temporário da câmera: vai embora assim
            // que a versão processada existe.
            onConfirm: (media, onProgress) => _processor.processAll(
              [media],
              imageSpec: imageSpec,
              videoSpec: videoSpec,
              deleteSources: true,
              onProgress: onProgress,
            ),
          );
          switch (outcome) {
            case CameraDone(:final value):
              return value;
            case CameraGalleryRequested():
              source = MediaSource.gallery;
            case null:
              return const [];
          }

        case MediaSource.gallery:
          final picked = await _pickFromGallery(context, maxItems, allowVideo);
          if (picked.isEmpty || !context.mounted) return const [];
          final result = await MediaPreviewScreen.open<List<MediaItem>>(
            context,
            items: picked,
            maxVideoDuration: videoSpec.maxDuration,
            onReplace: () => _picker.pickFromGallery(
              maxItems: maxItems,
              allowVideo: allowVideo,
            ),
            onConfirm: (items, onProgress) => _processor.processAll(
              items,
              imageSpec: imageSpec,
              videoSpec: videoSpec,
              onProgress: onProgress,
            ),
          );
          return result ?? const [];
      }
    }
    return const [];
  }

  /// Foto de perfil: origem → captura/escolha → recorte quadrado →
  /// processamento. `null` se a pessoa desistir.
  ///
  /// Sem prévia separada: o recorte já é a prévia, e é nele que a pessoa
  /// confirma. A câmera abre na lente frontal, só em modo foto.
  static Future<MediaItem?> pickAvatar(BuildContext context) async {
    const spec = ImageSpec.avatar;
    final appearance = _cropAppearance();

    Future<MediaItem?> cropAndProcess(XFile photo) async {
      final cropped = await _processor.cropSquare(photo, spec, appearance);
      if (cropped == null) return null;
      return _processor.processImage(cropped, spec, deleteSource: true);
    }

    var source = await showMediaSourceSheet(context, title: 'Foto de perfil');

    while (source != null) {
      if (!context.mounted) return null;
      switch (source) {
        case MediaSource.camera:
          final outcome = await CameraScreen.open<MediaItem>(
            context,
            review: false,
            preferredLens: CameraLensDirection.front,
            onConfirm: (media, _) async {
              try {
                return await cropAndProcess(media.file);
              } finally {
                File(media.path).delete().ignore();
              }
            },
          );
          switch (outcome) {
            case CameraDone(:final value):
              return value;
            case CameraGalleryRequested():
              source = MediaSource.gallery;
            case null:
              return null;
          }

        case MediaSource.gallery:
          final picked = await _pickFromGallery(context, 1, false);
          if (picked.isEmpty) return null;
          try {
            return await cropAndProcess(picked.first.file);
          } on MediaException catch (e) {
            if (context.mounted) await _explain(context, e);
            return null;
          }
      }
    }
    return null;
  }

  static Future<List<PickedMedia>> _pickFromGallery(
    BuildContext context,
    int maxItems,
    bool allowVideo,
  ) async {
    try {
      return await _picker.pickFromGallery(
        maxItems: maxItems,
        allowVideo: allowVideo,
      );
    } on MediaException catch (e) {
      if (context.mounted) await _explain(context, e);
      return const [];
    }
  }

  /// Permissão bloqueada ganha uma folha com o caminho para os ajustes; o
  /// resto é aviso curto.
  static Future<void> _explain(BuildContext context, MediaException e) async {
    if (e.failure != MediaFailure.permissionBlocked) {
      ScaffoldMessenger.maybeOf(
        context,
      )?.showSnackBar(SnackBar(content: Text(e.message)));
      return;
    }
    await showModalBottomSheet<void>(
      context: context,
      builder: (context) => _PermissionSheet(message: e.message),
    );
  }

  /// A tela de recorte é nativa e sempre escura, como a câmera.
  static CropAppearance _cropAppearance() {
    final colors = AppTheme.dark.extension<AppColors>()!;
    return CropAppearance(
      title: 'Ajustar foto',
      background: colors.noturno,
      foreground: colors.textPrimary,
      accent: colors.ambar,
      dim: colors.scrim.withValues(alpha: 0.7),
    );
  }
}

class _PermissionSheet extends StatelessWidget {
  final String message;

  const _PermissionSheet({required this.message});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screen,
          0,
          AppSpacing.screen,
          AppSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Icon(Icons.lock_outline_rounded, color: colors.ambar, size: 28),
            const SizedBox(height: AppSpacing.md),
            Text(
              message,
              textAlign: TextAlign.center,
              style: type.titleMedium.copyWith(color: colors.textPrimary),
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              'Abre as configurações do aparelho pra permitir o acesso.',
              textAlign: TextAlign.center,
              style: type.bodyMedium.copyWith(color: colors.textSecondary),
            ),
            const SizedBox(height: AppSpacing.xl),
            VibesterButton(
              label: 'Abrir configurações',
              onPressed: () {
                Navigator.of(context).pop();
                openAppSettings();
              },
            ),
            const SizedBox(height: AppSpacing.sm),
            VibesterButton(
              label: 'Cancelar',
              variant: VibesterButtonVariant.ghost,
              onPressed: () => Navigator.of(context).pop(),
            ),
          ],
        ),
      ),
    );
  }
}
