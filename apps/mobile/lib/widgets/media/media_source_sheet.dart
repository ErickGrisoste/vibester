import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/models/media/media_source.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Pergunta de onde vem a foto — câmera do Vibester ou galeria.
///
/// Substitui as duas listas de `ListTile` idênticas que viviam no composer e
/// no avatar. Duas peças grandes lado a lado, em vez de linhas de menu: é uma
/// escolha entre dois caminhos, e o alvo de toque grande deixa isso claro.
Future<MediaSource?> showMediaSourceSheet(
  BuildContext context, {
  String title = 'Adicionar foto',
}) {
  return showModalBottomSheet<MediaSource>(
    context: context,
    builder: (_) => _MediaSourceSheet(title: title),
  );
}

class _MediaSourceSheet extends StatelessWidget {
  final String title;

  const _MediaSourceSheet({required this.title});

  void _choose(BuildContext context, MediaSource source) {
    HapticFeedback.selectionClick();
    Navigator.of(context).pop(source);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

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
            Text(
              title.toUpperCase(),
              textAlign: TextAlign.center,
              style: context.typography.monoEyebrow.copyWith(
                color: colors.textMuted,
              ),
            ),
            const SizedBox(height: AppSpacing.lg),
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Expanded(
                    child: StaggeredEntrance(
                      index: 0,
                      child: _SourceTile(
                        icon: Icons.photo_camera_outlined,
                        label: 'Câmera',
                        hint: 'Tirar agora',
                        onTap: () => _choose(context, MediaSource.camera),
                      ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: StaggeredEntrance(
                      index: 1,
                      child: _SourceTile(
                        icon: Icons.photo_library_outlined,
                        label: 'Galeria',
                        hint: 'Do seu rolo',
                        onTap: () => _choose(context, MediaSource.gallery),
                      ),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.md),
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

class _SourceTile extends StatelessWidget {
  final IconData icon;
  final String label;
  final String hint;
  final VoidCallback onTap;

  const _SourceTile({
    required this.icon,
    required this.label,
    required this.hint,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Semantics(
      button: true,
      label: '$label. $hint',
      excludeSemantics: true,
      child: VibesterPressable(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        materialColor: colors.surface,
        pressScale: 0.96,
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.xl,
          ),
          decoration: BoxDecoration(
            borderRadius: AppRadius.mdAll,
            border: Border.all(color: colors.hairline),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.ambar.withValues(alpha: 0.14),
                  shape: BoxShape.circle,
                ),
                child: Icon(icon, size: 22, color: colors.ambar),
              ),
              const SizedBox(height: AppSpacing.md),
              Text(
                label,
                textAlign: TextAlign.center,
                style: type.titleMedium.copyWith(color: colors.textPrimary),
              ),
              const SizedBox(height: AppSpacing.xxs),
              Text(
                hint.toUpperCase(),
                textAlign: TextAlign.center,
                style: type.monoMicro.copyWith(color: colors.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
