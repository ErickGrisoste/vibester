import 'package:flutter/material.dart';
import 'package:mobile/models/onboarding/onboarding_slide.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/onboarding/onboarding_motion.dart';
import 'package:mobile/widgets/onboarding/visuals/discovery_visual.dart';
import 'package:mobile/widgets/onboarding/visuals/events_visual.dart';
import 'package:mobile/widgets/onboarding/visuals/places_visual.dart';
import 'package:mobile/widgets/onboarding/visuals/scattered_visual.dart';

/// Uma página do onboarding: visual em cima, texto embaixo.
///
/// Cuida de duas coisas:
///
/// - **Quando entrar.** A entrada começa assim que a página está ~30% na
///   tela — ainda durante o swipe, não depois dele — e só uma vez: voltar a
///   uma página já vista mostra ela pronta ([revealed]), porque repetir a
///   coreografia a cada ida e volta vira espera.
/// - **Profundidade no gesto.** O texto anda um pouco mais devagar que a
///   página e o visual um pouco mais rápido; cada visual ainda separa as
///   próprias camadas. O resultado é a próxima página já se montando
///   enquanto o dedo arrasta.
class OnboardingSlideView extends StatefulWidget {
  final OnboardingSlide slide;
  final int index;
  final PageController pages;

  /// Esta página já entrou antes nesta sessão do onboarding.
  final bool revealed;

  /// Avisado quando a entrada começa, para o host lembrar de [revealed].
  final VoidCallback onRevealed;

  const OnboardingSlideView({
    super.key,
    required this.slide,
    required this.index,
    required this.pages,
    required this.revealed,
    required this.onRevealed,
  });

  @override
  State<OnboardingSlideView> createState() => _OnboardingSlideViewState();
}

class _OnboardingSlideViewState extends State<OnboardingSlideView>
    with SingleTickerProviderStateMixin {
  late final AnimationController _intro = AnimationController(
    vsync: this,
    duration: onboardingIntroDuration,
    value: widget.revealed ? 1 : 0,
  );

  late SlideMotion _motion;
  bool _started = false;

  @override
  void initState() {
    super.initState();
    _started = widget.revealed;
    if (!_started) {
      widget.pages.addListener(_maybeStart);
      WidgetsBinding.instance.addPostFrameCallback((_) => _maybeStart());
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _motion = SlideMotion(
      intro: _intro,
      pages: widget.pages,
      index: widget.index,
      reduceMotion: AppMotion.reduceMotion(context),
    );
  }

  void _maybeStart() {
    if (_started || !mounted || _motion.delta.abs() > 0.7) return;
    _started = true;
    widget.pages.removeListener(_maybeStart);
    widget.onRevealed();
    if (_motion.reduceMotion) {
      _intro.value = 1;
    } else {
      _intro.forward();
    }
  }

  @override
  void dispose() {
    widget.pages.removeListener(_maybeStart);
    _intro.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final visual = switch (widget.slide.visual) {
      OnboardingVisual.scattered => ScatteredVisual(motion: _motion),
      OnboardingVisual.events => EventsVisual(motion: _motion),
      OnboardingVisual.places => PlacesVisual(motion: _motion),
      OnboardingVisual.discovery => DiscoveryVisual(motion: _motion),
    };

    return LayoutBuilder(
      builder: (context, constraints) {
        // Em aparelho baixo a manchete desce um degrau da escala: é ela ou o
        // visual, e sem o visual a página vira só texto de novo.
        final compact = constraints.maxHeight < 560;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SizedBox(height: compact ? AppSpacing.sm : AppSpacing.xl),
            Expanded(child: visual),
            SizedBox(height: compact ? AppSpacing.lg : AppSpacing.xl),
            Padding(
              padding: AppSpacing.screenH,
              child: _SlideText(
                slide: widget.slide,
                motion: _motion,
                compact: compact,
                width: constraints.maxWidth,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SlideText extends StatelessWidget {
  final OnboardingSlide slide;
  final SlideMotion motion;
  final bool compact;
  final double width;

  const _SlideText({
    required this.slide,
    required this.motion,
    required this.compact,
    required this.width,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final headline = compact ? type.displayLarge : type.displayHuge;
    final last = slide.headline.length - 1;

    // Montados uma vez; o `AnimatedBuilder` só troca opacidade e posição.
    final eyebrow = Text(
      slide.eyebrow,
      style: type.monoEyebrow.copyWith(color: colors.ambar),
    );
    final lines = [
      for (final (i, line) in slide.headline.indexed)
        // Cada linha encolhe sozinha se não couber — quebra de linha de
        // cartaz é decisão de texto, não do tamanho do aparelho.
        FittedBox(
          fit: BoxFit.scaleDown,
          alignment: Alignment.centerLeft,
          child: Text(
            line,
            maxLines: 1,
            style: headline.copyWith(
              color: i == last ? colors.ambar : colors.textPrimary,
            ),
          ),
        ),
    ];
    final body = Text(
      slide.body,
      style: (compact ? type.bodyMedium : type.bodyLarge).copyWith(
        color: colors.textSecondary,
      ),
    );

    return Semantics(
      container: true,
      child: AnimatedBuilder(
        animation: motion.listenable,
        builder: (context, _) {
          // O texto fica levemente para trás da página no swipe: é o plano
          // de fundo da composição, o visual é o da frente.
          final drift = parallaxOffset(motion, width, 0.12);

          Widget reveal(Widget child, double t) => Opacity(
            opacity: t.clamp(0.0, 1.0),
            child: Transform.translate(
              offset: drift + Offset(0, (1 - t) * AppMotion.distanceMedium),
              child: child,
            ),
          );

          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              reveal(eyebrow, motion.stagger(0, span: 0.35)),
              SizedBox(height: compact ? AppSpacing.sm : AppSpacing.md),
              for (final (i, line) in lines.indexed)
                reveal(line, motion.stagger(0.06, i: i, step: 0.07, span: 0.4)),
              SizedBox(height: compact ? AppSpacing.md : AppSpacing.lg),
              reveal(body, motion.stagger(0.24, span: 0.4)),
            ],
          );
        },
      ),
    );
  }
}
