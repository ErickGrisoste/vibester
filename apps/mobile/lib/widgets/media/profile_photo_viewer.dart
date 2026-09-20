import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

String profilePhotoHeroTag(String accountId) => 'profile-photo-$accountId';

/// Retrato do perfil (foto + grão) que amplia ao toque.
///
/// Sem foto não há o que ampliar: vira só o placeholder, sem toque.
class ProfilePortraitPhoto extends StatelessWidget {
  final String source;
  final String accountId;

  const ProfilePortraitPhoto({
    super.key,
    required this.source,
    required this.accountId,
  });

  @override
  Widget build(BuildContext context) {
    final hasPhoto = source.isNotEmpty;
    final tag = profilePhotoHeroTag(accountId);

    final photo = Stack(
      fit: StackFit.expand,
      children: [
        Hero(
          tag: tag,
          child: VibesterImage(
            source: source,
            placeholderIcon: Icons.person_outline_rounded,
            // Mesma decodificação da tela cheia: a foto voa pronta.
            fullResolution: hasPhoto,
          ),
        ),
        const IgnorePointer(child: Grain(opacity: 0.06, density: 0.5)),
      ],
    );

    if (!hasPhoto) return photo;

    return Semantics(
      button: true,
      label: 'Ampliar foto de perfil',
      child: VibesterPressable(
        onTap: () => showProfilePhoto(context, source: source, heroTag: tag),
        pressScale: AppMotion.scalePress,
        child: photo,
      ),
    );
  }
}

/// Abre a foto de perfil em tela cheia, voando a partir do retrato.
Future<void> showProfilePhoto(
  BuildContext context, {
  required String source,
  required String heroTag,
}) {
  final reduceMotion = context.reduceMotion;

  return Navigator.of(context).push(
    PageRouteBuilder<void>(
      opaque: false,
      transitionDuration: reduceMotion
          ? Duration.zero
          : AppMotion.enterDuration,
      reverseTransitionDuration: reduceMotion
          ? Duration.zero
          : AppMotion.exitDuration,
      pageBuilder: (_, _, _) =>
          ProfilePhotoViewer(source: source, heroTag: heroTag),
      transitionsBuilder: (_, animation, _, child) => FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: AppMotion.enter),
        child: child,
      ),
    ),
  );
}

/// Foto de perfil em tela cheia: pinça amplia até 4x, arrastar na vertical
/// (sem zoom) fecha, e o fundo clareia acompanhando o arrasto.
class ProfilePhotoViewer extends StatefulWidget {
  final String source;
  final String heroTag;

  const ProfilePhotoViewer({
    super.key,
    required this.source,
    required this.heroTag,
  });

  @override
  State<ProfilePhotoViewer> createState() => _ProfilePhotoViewerState();
}

class _ProfilePhotoViewerState extends State<ProfilePhotoViewer> {
  static const _dismissDistance = 120.0;
  static const _dismissVelocity = 700.0;
  static const _fadeDistance = 320.0;

  final TransformationController _transform = TransformationController();

  bool _zoomed = false;
  bool _dragging = false;
  double _dragY = 0;

  @override
  void initState() {
    super.initState();
    _transform.addListener(_onTransformChanged);
  }

  @override
  void dispose() {
    _transform
      ..removeListener(_onTransformChanged)
      ..dispose();
    super.dispose();
  }

  void _onTransformChanged() {
    final zoomed = _transform.value.getMaxScaleOnAxis() > 1.01;
    if (zoomed != _zoomed) setState(() => _zoomed = zoomed);
  }

  // O arrasto para fechar reaproveita os callbacks do InteractiveViewer em
  // vez de um GestureDetector por fora: os dois disputariam o mesmo gesto e o
  // reconhecedor de escala, mais interno, ganharia sempre.
  void _onInteractionStart(ScaleStartDetails details) {
    if (_zoomed || details.pointerCount > 1) return;
    setState(() => _dragging = true);
  }

  void _onInteractionUpdate(ScaleUpdateDetails details) {
    if (!_dragging) return;
    if (_zoomed || details.pointerCount > 1) {
      setState(() {
        _dragging = false;
        _dragY = 0;
      });
      return;
    }
    setState(() => _dragY += details.focalPointDelta.dy);
  }

  void _onInteractionEnd(ScaleEndDetails details) {
    if (!_dragging) return;
    final flung = details.velocity.pixelsPerSecond.dy.abs() > _dismissVelocity;
    if (_dragY.abs() > _dismissDistance || flung) {
      Navigator.maybePop(context);
      return;
    }
    setState(() {
      _dragging = false;
      _dragY = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final fade = (_dragY.abs() / _fadeDistance).clamp(0.0, 1.0);

    return Scaffold(
      backgroundColor: Colors.transparent,
      body: Stack(
        children: [
          Positioned.fill(
            child: ColoredBox(
              color: colors.scrim.withValues(alpha: 0.94 * (1 - fade * 0.7)),
            ),
          ),
          Positioned.fill(
            child: InteractiveViewer(
              transformationController: _transform,
              minScale: 1,
              maxScale: 4,
              panEnabled: _zoomed,
              onInteractionStart: _onInteractionStart,
              onInteractionUpdate: _onInteractionUpdate,
              onInteractionEnd: _onInteractionEnd,
              child: AnimatedContainer(
                duration: _dragging || context.reduceMotion
                    ? Duration.zero
                    : AppMotion.normal,
                curve: AppMotion.enter,
                transform: Matrix4.translationValues(0, _dragY, 0),
                child: Center(
                  // Avatar é recortado em 1:1 no upload; o quadrado com
                  // `cover` mantém o voo do Hero sem salto de enquadramento.
                  child: AspectRatio(
                    aspectRatio: 1,
                    child: Hero(
                      tag: widget.heroTag,
                      child: VibesterImage(
                        source: widget.source,
                        placeholderIcon: Icons.person_outline_rounded,
                        fullResolution: true,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          // Posicionado: um filho solto faria a Stack encolher ao tamanho do
          // botão, e a foto (Positioned.fill) iria junto.
          Positioned(
            top: 0,
            left: 0,
            child: SafeArea(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: AnimatedOpacity(
                  opacity: _dragging ? 0 : 1,
                  duration: AppMotion.fast,
                  child: Semantics(
                    button: true,
                    label: 'Fechar foto',
                    child: VibesterPressable(
                      onTap: () => Navigator.maybePop(context),
                      borderRadius: AppRadius.pillAll,
                      child: Container(
                        width: 44,
                        height: 44,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: colors.scrim.withValues(alpha: 0.4),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: Colors.white.withValues(alpha: 0.14),
                          ),
                        ),
                        child: const Icon(
                          Icons.close_rounded,
                          size: 20,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
