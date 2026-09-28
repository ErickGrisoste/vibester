import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/onboarding/onboarding_logo.dart';
import 'package:mobile/widgets/onboarding/onboarding_motion.dart';

/// Página 1 — o problema: a informação do rolê espalhada.
///
/// Story, grupo, flyer, post, perfil, link: cada fonte vira um fragmento
/// abstrato solto pela tela — representa a fonte sem imitar a interface de
/// ninguém, e sem inventar evento ou lugar. Ao arrastar para a página 2, os
/// fragmentos **convergem** para a marca no centro, que fica parada enquanto
/// a página sai e se dissolve quando os eventos chegam: a passagem da página 1
/// para a 2 é a própria tese do app — "tava espalhado, agora tá aqui".
class ScatteredVisual extends StatelessWidget {
  final SlideMotion motion;

  const ScatteredVisual({super.key, required this.motion});

  /// Posição em fração da meia-largura/meia-altura (a partir do centro),
  /// inclinação em graus, e o tipo de fonte. O miolo fica livre para a marca.
  static const _fragments = [
    _Fragment(Offset(-0.74, -0.66), -7, _Source.story),
    _Fragment(Offset(0.6, -0.74), 5, _Source.chat),
    _Fragment(Offset(0.8, 0.12), 8, _Source.flyer),
    _Fragment(Offset(-0.8, 0.24), -5, _Source.post),
    _Fragment(Offset(-0.3, 0.84), -3, _Source.link),
    _Fragment(Offset(0.42, 0.78), 4, _Source.profile),
  ];

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final size = constraints.biggest;
        final center = size.center(Offset.zero);
        // Fragmentos desenhados numa régua de ~300pt e escalados à área —
        // é o que deixa a composição igual de 320 a 600 de largura.
        final scale = (size.shortestSide / 300).clamp(0.55, 1.15);
        final reach = Offset(
          (size.width / 2 - 56 * scale).clamp(0.0, double.infinity),
          (size.height / 2 - 44 * scale).clamp(0.0, double.infinity),
        );

        return AmbientLoop(
          builder: (context, ambient) => AnimatedBuilder(
            animation: Listenable.merge([motion.listenable, ambient]),
            builder: (context, _) {
              // Convergência: acompanha o dedo, mas fecha antes da metade do
              // gesto para a marca já estar formada quando a página 2 entra.
              final converge = Curves.easeInOutCubic.transform(
                (motion.delta * 1.6).clamp(0.0, 1.0),
              );

              return Stack(
                clipBehavior: Clip.none,
                children: [
                  _brand(context, size, converge),
                  for (final (i, fragment) in _fragments.indexed)
                    _fragment(
                      fragment,
                      i,
                      center: center,
                      reach: reach,
                      scale: scale,
                      converge: converge,
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

  Widget _brand(BuildContext context, Size size, double converge) {
    final entry = motion.stagger(0.35, span: 0.5);
    // Em repouso a marca é só uma presença; cresce enquanto absorve os
    // fragmentos, e some quando a página 2 já ocupa a tela.
    final fadeOut = 1 - ((motion.delta - 0.55) / 0.35).clamp(0.0, 1.0);
    final opacity = (entry * (0.1 + 0.9 * converge) * fadeOut).clamp(0.0, 1.0);
    // Segura a marca no lugar enquanto a página desliza: é ela que atravessa
    // de uma página para a outra.
    final pin = motion.reduceMotion ? 0.0 : motion.delta * size.width;

    return Positioned.fill(
      child: IgnorePointer(
        child: Transform.translate(
          offset: Offset(pin, 0),
          child: Center(
            child: Opacity(
              opacity: opacity,
              child: Transform.scale(
                scale: 0.82 + 0.18 * converge,
                child: OnboardingLogo(width: size.width * 0.5),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _fragment(
    _Fragment fragment,
    int i, {
    required Offset center,
    required Offset reach,
    required double scale,
    required double converge,
    required Animation<double> ambient,
  }) {
    final entry = motion.stagger(
      0.05,
      i: i,
      step: 0.07,
      span: 0.5,
      curve: AppMotion.emphasis,
    );
    final spread = Offset(fragment.at.dx * reach.dx, fragment.at.dy * reach.dy);
    // Entram vindo de um pouco mais longe — a sensação é de "caindo" na tela.
    final settled = center + spread * lerpDouble(1.3, 1, entry)!;
    final float = motion.reduceMotion
        ? Offset.zero
        : Offset(0, ambientWave(ambient, i * 0.17) * 5 * (1 - converge));
    final position = Offset.lerp(settled, center, converge)! + float;
    final opacity = (entry.clamp(0.0, 1.0) * (1 - converge)).clamp(0.0, 1.0);

    return Positioned(
      left: position.dx,
      top: position.dy,
      child: FractionalTranslation(
        translation: const Offset(-0.5, -0.5),
        child: Opacity(
          opacity: opacity,
          child: Transform.rotate(
            angle: fragment.tilt * (1 - converge) * 0.0174533,
            child: Transform.scale(
              scale: scale * (0.85 + 0.15 * entry) * (1 - 0.7 * converge),
              child: _FragmentCard(source: fragment.source),
            ),
          ),
        ),
      ),
    );
  }
}

enum _Source { story, chat, flyer, post, link, profile }

class _Fragment {
  final Offset at;
  final double tilt;
  final _Source source;

  const _Fragment(this.at, this.tilt, this.source);
}

/// Um fragmento: ícone da fonte, rótulo em mono e barras no lugar do texto.
/// Barra, não frase — o fragmento representa "informação", não um conteúdo
/// específico, e conteúdo inventado seria dado falso.
class _FragmentCard extends StatelessWidget {
  final _Source source;

  const _FragmentCard({required this.source});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    final (IconData icon, String label) = switch (source) {
      _Source.story => (Icons.amp_stories_outlined, 'STORY'),
      _Source.chat => (Icons.forum_outlined, 'GRUPO'),
      _Source.flyer => (Icons.local_activity_outlined, 'FLYER'),
      _Source.post => (Icons.photo_outlined, 'POST'),
      _Source.link => (Icons.link, 'LINK'),
      _Source.profile => (Icons.storefront_outlined, 'PERFIL'),
    };

    final tag = Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 13, color: colors.ambar),
        const SizedBox(width: AppSpacing.xs + 1),
        Text(label, style: type.monoMicro.copyWith(color: colors.textMuted)),
      ],
    );

    if (source == _Source.story) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 58,
            height: 58,
            padding: const EdgeInsets.all(AppStroke.marker),
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: LinearGradient(
                colors: [colors.ambar, colors.brasa],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
            child: Container(
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: colors.surfaceRaised,
                border: Border.all(color: colors.noturno, width: 2),
              ),
              child: Icon(icon, size: 20, color: colors.ambar),
            ),
          ),
          const SizedBox(height: AppSpacing.xs + 2),
          Text(label, style: type.monoMicro.copyWith(color: colors.textMuted)),
        ],
      );
    }

    if (source == _Source.link) {
      return Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: colors.surfaceRaised,
          borderRadius: AppRadius.pillAll,
          border: Border.all(color: colors.hairline),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            tag,
            const SizedBox(width: AppSpacing.sm),
            _Bar(width: 34, color: colors.outline),
          ],
        ),
      );
    }

    // Sem largura fixa: o cartão abraça o conteúdo, então rótulo em fonte
    // maior (acessibilidade) alarga o fragmento em vez de estourar.
    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm + 1),
      decoration: BoxDecoration(
        color: colors.surfaceRaised,
        borderRadius: AppRadius.mdAll,
        border: Border.all(color: colors.hairline),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (source == _Source.flyer || source == _Source.post) ...[
            Container(
              width: source == _Source.flyer ? 60 : 86,
              height: source == _Source.flyer ? 58 : 40,
              decoration: BoxDecoration(
                borderRadius: AppRadius.smAll,
                gradient: source == _Source.flyer
                    ? LinearGradient(
                        colors: [
                          colors.ambar.withValues(alpha: 0.85),
                          colors.brasa.withValues(alpha: 0.85),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      )
                    : null,
                color: source == _Source.post ? colors.surface : null,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
          ],
          if (source == _Source.profile)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Container(
                  width: 20,
                  height: 20,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.surface,
                    border: Border.all(color: colors.ambar, width: 1.5),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                // Sem o ícone: o avatar já diz "perfil", e a linha é curta.
                Text(
                  label,
                  style: type.monoMicro.copyWith(color: colors.textMuted),
                ),
              ],
            )
          else
            tag,
          const SizedBox(height: AppSpacing.sm),
          _Bar(width: source == _Source.flyer ? 50 : 72, color: colors.outline),
          const SizedBox(height: AppSpacing.xs + 1),
          _Bar(
            width: source == _Source.flyer ? 34 : 48,
            color: colors.hairline,
          ),
        ],
      ),
    );
  }
}

class _Bar extends StatelessWidget {
  final double width;
  final Color color;

  const _Bar({required this.width, required this.color});

  @override
  Widget build(BuildContext context) => Container(
    width: width,
    height: 4,
    decoration: BoxDecoration(color: color, borderRadius: AppRadius.pillAll),
  );
}
