import 'package:flutter/material.dart';
import 'package:mobile/models/media/media_item.dart';
import 'package:mobile/service/media/media_processor.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/media/media_flow.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Foto de perfil editável.
///
/// Segue o mesmo tratamento do retrato no perfil — quadrado com canto rasgado,
/// grão por cima — em vez do avatar circular com anel âmbar, para a foto ser a
/// mesma coisa nas duas telas. O selo de editar fica colado no canto, com alvo
/// de toque grande.
///
/// A foto vem do `MediaFlow` (câmera frontal ou galeria → recorte quadrado →
/// 512px comprimido). Enquanto sobe, a foto nova aparece com um véu e um
/// indicador; se o envio falhar ([onImageChanged] devolve `false`), volta a
/// anterior — antes a foto nova ficava na tela mesmo sem ter subido.
class EditableAvatar extends StatefulWidget {
  final String? imageUrl;

  /// Sobe a foto e devolve se deu certo.
  final Future<bool> Function(MediaItem image)? onImageChanged;

  /// Meia-altura da foto, mantido com este nome por compatibilidade com as
  /// chamadas existentes.
  final double radius;

  const EditableAvatar({
    super.key,
    this.imageUrl,
    this.onImageChanged,
    this.radius = 0,
  });

  @override
  State<EditableAvatar> createState() => _EditableAvatarState();
}

class _EditableAvatarState extends State<EditableAvatar> {
  MediaItem? _image;
  bool _uploading = false;

  double get _size => (widget.radius > 0 ? widget.radius : 48) * 2;

  @override
  void dispose() {
    if (_image != null && !_uploading) MediaProcessor.discard(_image!);
    super.dispose();
  }

  Future<void> _change() async {
    if (_uploading) return;

    final picked = await MediaFlow.pickAvatar(context);
    if (picked == null || !mounted) return;

    final previous = _image;
    setState(() {
      _image = picked;
      _uploading = true;
    });

    final ok = await widget.onImageChanged?.call(picked) ?? true;
    if (!mounted) {
      if (!ok) MediaProcessor.discard(picked);
      return;
    }

    setState(() {
      _uploading = false;
      if (!ok) _image = previous;
    });
    // Apaga a que saiu da tela: a anterior, se a nova subiu; a nova, se falhou.
    final stale = ok ? previous : picked;
    if (stale != null) MediaProcessor.discard(stale);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      label: _uploading ? 'Enviando foto de perfil' : 'Trocar foto de perfil',
      child: VibesterPressable(
        onTap: _uploading ? null : _change,
        borderRadius: AppRadius.smAll,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            Container(
              decoration: BoxDecoration(
                boxShadow: [
                  BoxShadow(
                    color: colors.scrim.withValues(alpha: 0.5),
                    offset: const Offset(4, 4),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(AppRadius.sm),
                  topRight: Radius.circular(AppRadius.sm),
                  bottomRight: Radius.circular(AppRadius.sm),
                ),
                child: SizedBox(
                  width: _size,
                  height: _size * 1.15,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      AnimatedSwitcher(
                        duration: context.adaptiveMotion(AppMotion.ui),
                        child: VibesterImage(
                          key: ValueKey(_image?.path ?? widget.imageUrl),
                          source: _image?.path ?? widget.imageUrl ?? '',
                          placeholderIcon: Icons.add_a_photo_outlined,
                        ),
                      ),
                      const Grain(opacity: 0.06, density: 0.5),
                      AnimatedOpacity(
                        opacity: _uploading ? 1 : 0,
                        duration: context.adaptiveMotion(AppMotion.micro),
                        child: ColoredBox(
                          color: colors.scrim.withValues(alpha: 0.45),
                          child: Center(
                            child: SizedBox(
                              width: 22,
                              height: 22,
                              child: _uploading
                                  ? CircularProgressIndicator(
                                      strokeWidth: 2,
                                      color: colors.ambar,
                                    )
                                  : null,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            Positioned(
              right: -10,
              bottom: -10,
              child: Container(
                width: 34,
                height: 34,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.ambar,
                  borderRadius: AppRadius.smAll,
                  border: Border.all(color: colors.noturno, width: 2),
                ),
                child: Icon(
                  Icons.edit_outlined,
                  size: 15,
                  color: colors.onAmbar,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
