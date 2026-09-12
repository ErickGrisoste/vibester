import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Faz um item de lista/grid entrar com fade + translateY + scale sutil,
/// com física de mola de verdade (overshoot + assentamento — seção 9/12 do
/// briefing de motion 2.0), atrasado por [index] * [AppMotion.staggerStep].
///
/// Cada item recebe uma pequena variação determinística de atraso (seção 13
/// — "não mecânico", mas consistente entre rebuilds) e o atraso é limitado
/// aos primeiros [maxStagger] itens para não fazer o usuário esperar numa
/// lista longa.
///
/// Usa apenas um `AnimationController` leve por item (sem Ticker global
/// compartilhado) — aceitável aqui porque só itens realmente visíveis
/// existem simultaneamente; respeita "reduzir movimento".
class StaggeredEntrance extends StatefulWidget {
  final int index;
  final Widget child;
  final int maxStagger;

  const StaggeredEntrance({
    super.key,
    required this.index,
    required this.child,
    this.maxStagger = 10,
  });

  @override
  State<StaggeredEntrance> createState() => _StaggeredEntranceState();
}

class _StaggeredEntranceState extends State<StaggeredEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    value: 0,
    lowerBound: -0.5,
    upperBound: 1.5,
  );
  Timer? _timer;
  bool _dependenciesResolved = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_dependenciesResolved) return;
    _dependenciesResolved = true;

    if (context.reduceMotion) {
      _controller.value = 1;
      return;
    }

    final clampedIndex = widget.index.clamp(0, widget.maxStagger);
    // Variação pequena e determinística (não aleatória de verdade) pra
    // quebrar a sensação mecânica sem perder consistência entre rebuilds.
    final jitter = (widget.index * 13) % 24;
    final delay =
        AppMotion.staggerStep * clampedIndex + Duration(milliseconds: jitter);

    if (delay == Duration.zero) {
      _controller.value = 1;
    } else {
      _timer = Timer(delay, () {
        if (mounted) {
          _controller.animateWith(
            SpringSimulation(AppMotion.springBouncy, 0, 1, 0),
          );
        }
      });
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        final t = _controller.value;
        final opacity = t.clamp(0.0, 1.0);
        final translateY = (1 - t) * AppMotion.distanceLarge;
        final scale = 0.96 + (t * 0.04);
        return Opacity(
          opacity: opacity,
          child: Transform.translate(
            offset: Offset(0, translateY),
            child: Transform.scale(scale: scale, child: child),
          ),
        );
      },
      child: RepaintBoundary(child: widget.child),
    );
  }
}
