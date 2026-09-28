import 'dart:math' as math;
import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/graffiti/sticker_tag.dart';
import 'package:mobile/widgets/onboarding/onboarding_logo.dart';
import 'package:mobile/widgets/onboarding/onboarding_motion.dart';
import 'package:provider/provider.dart';

/// Página 4 — o fechamento: tudo o que apareceu antes, junto.
///
/// Um cartaz de evento, a foto de um lugar, categorias como adesivo, o pino
/// do mapa e o check-in orbitam a marca. Eles entram **de fora para dentro**
/// e, no swipe, se afastam quando a página sai e se juntam quando ela chega:
/// o movimento da última página aponta para o centro, logo acima do CTA.
///
/// As fotos são as do conteúdo real carregado para as páginas 2 e 3; sem
/// elas, caem nas capas de categoria do produto.
class DiscoveryVisual extends StatelessWidget {
  final SlideMotion motion;

  const DiscoveryVisual({super.key, required this.motion});

  /// Ângulo (graus, 0 = direita, sentido horário) e fase do laço ambiente.
  static const _orbit = [
    (-150.0, 0.0),
    (-38.0, 0.21),
    (28.0, 0.43),
    (72.0, 0.64),
    (150.0, 0.12),
    (118.0, 0.86),
  ];

  @override
  Widget build(BuildContext context) {
    final eventImage = context.select<EventsListProvider, String?>(
      (p) => p.events
          .where((e) => e.isUpcoming && e.imageUrl.isNotEmpty)
          .map((EventModel e) => e.imageUrl)
          .firstOrNull,
    );
    final placeImage = context.select<PlaceListProvider, String?>(
      (p) => p.places
          .map(
            (PlaceModel p) =>
                p.profileImage.isNotEmpty ? p.profileImage : p.bannerImage,
          )
          .where((image) => image.isNotEmpty)
          .firstOrNull,
    );

    final colors = context.colors;
    final items = <Widget>[
      _Photo(
        source: eventImage ?? 'assets/img/eventos.jpg',
        width: 88,
        height: 55,
        frame: colors.ambar,
      ),
      const StickerTag(label: 'BAR', tiltDegrees: 4, animateIn: false),
      _Photo(
        source: placeImage ?? 'assets/img/bares.jpg',
        width: 62,
        height: 62,
        frame: colors.hairline,
      ),
      _Badge(icon: Icons.place_outlined, color: colors.ambar),
      StickerTag(
        label: 'BALADA',
        color: colors.brasa,
        tiltDegrees: -4,
        animateIn: false,
      ),
      _Badge(icon: Icons.check_rounded, color: colors.brasa),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final center = size.center(Offset.zero);
        final scale = (size.shortestSide / 280).clamp(0.6, 1.15);
        final radius = Offset(
          (size.width / 2 - 54 * scale).clamp(0.0, double.infinity),
          (size.height / 2 - 36 * scale).clamp(0.0, double.infinity),
        );
        final logo = OnboardingLogo(width: math.min(size.width * 0.46, 220));

        return AmbientLoop(
          builder: (context, ambient) => AnimatedBuilder(
            animation: Listenable.merge([motion.listenable, ambient]),
            builder: (context, _) {
              // Afastados enquanto a página não está centrada; juntos quando
              // ela assenta.
              final spread = 1 + motion.parallax.abs() * 0.7;
              final brand = motion.stagger(
                0.3,
                span: 0.5,
                curve: AppMotion.emphasis,
              );

              return Stack(
                clipBehavior: Clip.none,
                children: [
                  Positioned.fill(
                    child: Center(
                      child: Opacity(
                        opacity: brand.clamp(0.0, 1.0),
                        child: Transform.scale(
                          scale: lerpDouble(0.8, 1, brand),
                          child: logo,
                        ),
                      ),
                    ),
                  ),
                  for (final (i, item) in items.indexed)
                    _orbiting(
                      item,
                      i,
                      center: center,
                      radius: radius,
                      scale: scale,
                      spread: spread,
                      ambient: ambient,
                    ),
                ],
              );
            },
          ),
        );
      },
    );
  }

  Widget _orbiting(
    Widget item,
    int i, {
    required Offset center,
    required Offset radius,
    required double scale,
    required double spread,
    required Animation<double> ambient,
  }) {
    final (degrees, phase) = _orbit[i];
    final entry = motion.stagger(
      0.05,
      i: i,
      step: 0.06,
      span: 0.55,
      curve: AppMotion.emphasis,
    );
    final angle = degrees * math.pi / 180;
    // Entram de quase o dobro da distância e assentam na órbita.
    final reach = lerpDouble(1.9, 1, entry)! * spread;
    final float = motion.reduceMotion
        ? Offset.zero
        : Offset(
            ambientWave(ambient, phase) * 3,
            ambientWave(ambient, phase + 0.25) * 4,
          );
    final position =
        center +
        Offset(
          math.cos(angle) * radius.dx * reach,
          math.sin(angle) * radius.dy * reach,
        ) +
        float;

    return Positioned(
      left: position.dx,
      top: position.dy,
      child: FractionalTranslation(
        translation: const Offset(-0.5, -0.5),
        child: Opacity(
          opacity: (entry * 1.4).clamp(0.0, 1.0),
          child: Transform.scale(scale: scale, child: item),
        ),
      ),
    );
  }
}

class _Photo extends StatelessWidget {
  final String source;
  final double width;
  final double height;
  final Color frame;

  const _Photo({
    required this.source,
    required this.width,
    required this.height,
    required this.frame,
  });

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      position: DecorationPosition.foreground,
      decoration: BoxDecoration(
        borderRadius: AppRadius.smAll,
        border: Border.all(color: frame, width: AppStroke.regular),
      ),
      child: ClipRRect(
        borderRadius: AppRadius.smAll,
        child: VibesterImage(source: source, width: width, height: height),
      ),
    );
  }
}

class _Badge extends StatelessWidget {
  final IconData icon;
  final Color color;

  const _Badge({required this.icon, required this.color});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      width: 40,
      height: 40,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: colors.surfaceRaised,
        border: Border.all(color: color.withValues(alpha: 0.6)),
      ),
      child: Icon(icon, size: 20, color: color),
    );
  }
}
