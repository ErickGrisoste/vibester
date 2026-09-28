import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/widgets/cards/event/event_poster_card.dart';
import 'package:mobile/widgets/onboarding/onboarding_motion.dart';
import 'package:provider/provider.dart';

/// Página 2 — os eventos, num lugar só.
///
/// Os cards são os **de verdade**: `EventPosterCard` com os próximos eventos
/// que a API devolveu (o onboarding roda com a sessão já aberta, e a
/// `OnboardingScreen` dispara a busca ao montar). É a demonstração do produto,
/// não um mockup — o usuário vê exatamente o que vai encontrar depois.
///
/// Sem evento (API fora, cidade sem agenda, ainda carregando), as linhas viram
/// silhuetas do mesmo card: a composição continua de pé e nada é inventado.
///
/// O painel é desenhado numa largura fixa de "tela de celular" e encolhido
/// para caber (`FittedBox`), como um screenshot — assim nenhum aparelho
/// estoura e a proporção do card real é preservada.
class EventsVisual extends StatelessWidget {
  final SlideMotion motion;

  const EventsVisual({super.key, required this.motion});

  static const _rows = 3;
  static const _panelWidth = 340.0;

  static List<EventModel> _pick(List<EventModel> events) {
    final upcoming = events.where((e) => e.isUpcoming).toList()
      ..sort((a, b) => a.dataDoEvento.compareTo(b.dataDoEvento));
    return upcoming.take(_rows).toList();
  }

  @override
  Widget build(BuildContext context) {
    final events = context.select<EventsListProvider, List<EventModel>>(
      (p) => _pick(p.events),
    );

    // Os cards montam uma vez; por frame só mudam transform e opacidade.
    final rows = [
      for (var i = 0; i < _rows; i++)
        i < events.length
            ? IgnorePointer(
                child: EventPosterCard(
                  event: events[i],
                  variant: EventCardVariant.wide,
                  hero: false,
                ),
              )
            : const _GhostEventRow(),
    ];
    final header = _PanelHeader(live: events.isNotEmpty);

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screen),
      child: LayoutBuilder(
        builder: (context, constraints) => AnimatedBuilder(
          animation: motion.listenable,
          builder: (context, _) {
            final panel = motion.stagger(0, span: 0.45);
            final width = constraints.maxWidth;

            return Center(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Opacity(
                  opacity: panel.clamp(0.0, 1.0),
                  child: Transform.translate(
                    offset:
                        Offset(0, (1 - panel) * AppMotion.distanceLarge) +
                        parallaxOffset(motion, width, -0.06),
                    child: Transform.scale(
                      scale: lerpDouble(0.94, 1, panel),
                      child: _panel(context, header, rows, width),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _panel(
    BuildContext context,
    Widget header,
    List<Widget> rows,
    double width,
  ) {
    final colors = context.colors;

    return Container(
      width: _panelWidth,
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.lg,
        AppSpacing.md,
        AppSpacing.lg,
        AppSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.lgAll,
        border: Border.all(color: colors.hairline),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          header,
          const SizedBox(height: AppSpacing.xs),
          for (final (i, row) in rows.indexed) _row(row, i, width),
        ],
      ),
    );
  }

  /// Cada card entra da direita, um depois do outro, com um overshoot leve
  /// — e no swipe cada um anda um pouco mais que o anterior, o que dá a
  /// profundidade de uma pilha sem gráfico 3D.
  Widget _row(Widget row, int i, double width) {
    final entry = motion.stagger(
      0.18,
      i: i,
      step: 0.12,
      span: 0.5,
      curve: AppMotion.emphasis,
    );

    return Opacity(
      opacity: entry.clamp(0.0, 1.0),
      child: Transform.translate(
        offset:
            Offset((1 - entry) * 56, 0) +
            parallaxOffset(motion, width, -0.05 * (i + 1)),
        child: row,
      ),
    );
  }
}

class _PanelHeader extends StatelessWidget {
  final bool live;

  const _PanelHeader({required this.live});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Row(
      children: [
        Text(
          'PRÓXIMOS ROLÊS',
          style: context.typography.monoEyebrow.copyWith(color: colors.ambar),
        ),
        const Spacer(),
        Icon(
          Icons.local_activity_outlined,
          size: 16,
          color: live ? colors.ambar : colors.textDisabled,
        ),
      ],
    );
  }
}

/// Silhueta estática de `EventPosterCard.wide` — bloco de data, duas linhas
/// e miniatura. Parada de propósito: shimmer eterno diria "carregando" mesmo
/// quando a resposta já foi "não tem evento".
class _GhostEventRow extends StatelessWidget {
  const _GhostEventRow();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    Widget block(double w, double h, {Color? color}) => Container(
      width: w,
      height: h,
      decoration: BoxDecoration(
        color: color ?? colors.surfaceRaised,
        borderRadius: AppRadius.smAll,
      ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          block(40, 60),
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                block(150, 12),
                const SizedBox(height: AppSpacing.sm),
                block(96, 8, color: colors.hairline),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          block(76, 76),
        ],
      ),
    );
  }
}
