import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/theme/app_colors.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Coração de curtida que anima quando o estado muda, não quando é tocado.
///
/// Ao virar curtido: encolhe, cresce além do tamanho final e assenta
/// (seção 6 do briefing de motion 2.0), com um anel que se abre e faíscas em
/// âmbar/brasa — a mesma linguagem do botão de seguir do lugar. Ao descurtir,
/// só um recuo curto: celebrar a retirada seria ruído.
///
/// Por reagir a [liked] (e não a um `onTap` próprio), qualquer origem da
/// curtida anima igual — o botão, o toque duplo na foto ou a atualização
/// otimista do provider. Com "reduzir movimento" ativo, a troca é instantânea.
class LikeHeart extends StatefulWidget {
  final bool liked;
  final Color inactiveColor;
  final double size;

  const LikeHeart({
    super.key,
    required this.liked,
    required this.inactiveColor,
    this.size = 24,
  });

  @override
  State<LikeHeart> createState() => _LikeHeartState();
}

class _LikeHeartState extends State<LikeHeart>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  /// Se a animação em curso é a de curtir (celebra) ou a de descurtir (recua).
  bool _celebrating = false;

  /// Lido no build: `didUpdateWidget` roda antes dele e usa o último valor.
  bool _reduceMotion = false;

  static final _likeScale = TweenSequence<double>([
    TweenSequenceItem(
      tween: Tween(
        begin: 1.0,
        end: 0.8,
      ).chain(CurveTween(curve: Curves.easeOut)),
      weight: 25,
    ),
    TweenSequenceItem(
      tween: Tween(
        begin: 0.8,
        end: 1.3,
      ).chain(CurveTween(curve: Curves.easeOut)),
      weight: 40,
    ),
    TweenSequenceItem(
      tween: Tween(
        begin: 1.3,
        end: 1.0,
      ).chain(CurveTween(curve: Curves.easeOutBack)),
      weight: 35,
    ),
  ]);

  static final _unlikeScale = TweenSequence<double>([
    TweenSequenceItem(
      tween: Tween(
        begin: 1.0,
        end: 0.82,
      ).chain(CurveTween(curve: Curves.easeOut)),
      weight: 35,
    ),
    TweenSequenceItem(
      tween: Tween(
        begin: 0.82,
        end: 1.0,
      ).chain(CurveTween(curve: Curves.easeOutCubic)),
      weight: 65,
    ),
  ]);

  static const _sparkAngles = [-90.0, -30.0, 30.0, 90.0, 150.0, 210.0];

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: AppMotion.favorite,
    );
  }

  @override
  void didUpdateWidget(LikeHeart oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.liked == oldWidget.liked) return;

    if (widget.liked) HapticFeedback.lightImpact();
    if (_reduceMotion) {
      _controller.value = 0;
      return;
    }
    _celebrating = widget.liked;
    _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<Widget> _burst(double t, AppColors colors) {
    final size = widget.size;
    // Anel e faíscas saem quando o coração para de encolher e começa a
    // crescer — é esse o momento do "estouro".
    final ring = const Interval(0.2, 0.75, curve: Curves.easeOut).transform(t);
    final spread = const Interval(
      0.25,
      1,
      curve: Curves.easeOutCubic,
    ).transform(t);
    final sparkOpacity = 1 - const Interval(0.6, 1).transform(t);
    final dot = size * 0.16;

    return [
      if (ring > 0 && ring < 1)
        Opacity(
          opacity: (1 - ring) * 0.7,
          child: Transform.scale(
            scale: 0.6 + ring,
            child: Container(
              width: size,
              height: size,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                border: Border.all(
                  color: colors.brasa,
                  width: 0.5 + 2 * (1 - ring),
                ),
              ),
            ),
          ),
        ),
      if (spread > 0)
        for (var i = 0; i < _sparkAngles.length; i++)
          Transform.translate(
            offset: Offset.fromDirection(
              _sparkAngles[i] * math.pi / 180,
              size * (0.45 + 0.5 * spread),
            ),
            child: Opacity(
              opacity: sparkOpacity,
              child: Container(
                width: dot,
                height: dot,
                decoration: BoxDecoration(
                  color: i.isEven ? colors.ambar : colors.brasa,
                  shape: BoxShape.circle,
                ),
              ),
            ),
          ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    _reduceMotion = context.reduceMotion;
    final colors = context.colors;

    return SizedBox.square(
      dimension: widget.size + 4,
      child: AnimatedBuilder(
        animation: _controller,
        child: Icon(
          widget.liked ? Icons.favorite : Icons.favorite_border_rounded,
          color: widget.liked ? colors.brasa : widget.inactiveColor,
          size: widget.size,
        ),
        builder: (context, icon) {
          final t = _controller.value;
          final scale = _celebrating ? _likeScale : _unlikeScale;
          return Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              if (_controller.isAnimating && _celebrating) ..._burst(t, colors),
              Transform.scale(scale: scale.transform(t), child: icon),
            ],
          );
        },
      ),
    );
  }
}
