import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/theme/app_colors.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Celebração de confirmar presença — a mesma linguagem do `LikeHeart`
/// (encolhe, cresce além do tamanho final e assenta, com anel que se abre e
/// faíscas em âmbar/brasa), adaptada a um botão largo em pílula: a escala tem
/// amplitude menor para não estourar a largura da tela, o anel acompanha a
/// pílula e as faíscas saem das bordas, não de um ponto.
///
/// Dispara sempre que [trigger] muda de valor. Quem usa decide quando
/// celebrar (só a ação do usuário, nunca o status carregado da API). Com
/// "reduzir movimento" ativo, fica só o háptico.
class PresencePop extends StatefulWidget {
  final Widget child;
  final Object? trigger;

  const PresencePop({super.key, required this.child, required this.trigger});

  @override
  State<PresencePop> createState() => _PresencePopState();
}

class _PresencePopState extends State<PresencePop>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: AppMotion.favorite,
  );

  static final _scale = TweenSequence<double>([
    TweenSequenceItem(
      tween: Tween(
        begin: 1.0,
        end: 0.93,
      ).chain(CurveTween(curve: Curves.easeOut)),
      weight: 25,
    ),
    TweenSequenceItem(
      tween: Tween(
        begin: 0.93,
        end: 1.06,
      ).chain(CurveTween(curve: Curves.easeOut)),
      weight: 40,
    ),
    TweenSequenceItem(
      tween: Tween(
        begin: 1.06,
        end: 1.0,
      ).chain(CurveTween(curve: Curves.easeOutBack)),
      weight: 35,
    ),
  ]);

  static const _sparkAngles = [
    -90.0,
    -45.0,
    0.0,
    45.0,
    90.0,
    135.0,
    180.0,
    225.0,
  ];

  @override
  void didUpdateWidget(covariant PresencePop old) {
    super.didUpdateWidget(old);
    if (widget.trigger == old.trigger) return;

    HapticFeedback.lightImpact();
    if (context.reduceMotion) return;
    _controller.forward(from: 0);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<Widget> _burst(double t, Size size, AppColors colors) {
    // Anel e faíscas saem quando o botão para de encolher e começa a crescer
    // — o mesmo "estouro" do coração.
    final ring = const Interval(0.2, 0.75, curve: Curves.easeOut).transform(t);
    final spread = const Interval(
      0.25,
      1,
      curve: Curves.easeOutCubic,
    ).transform(t);
    final sparkOpacity = 1 - const Interval(0.6, 1).transform(t);
    const dot = 6.0;
    final halfW = size.width / 2;
    final halfH = size.height / 2;

    return [
      if (ring > 0 && ring < 1)
        Positioned.fill(
          child: IgnorePointer(
            child: Opacity(
              opacity: (1 - ring) * 0.7,
              child: Transform(
                alignment: Alignment.center,
                // Cresce a mesma distância absoluta nos dois eixos, para a
                // pílula não virar uma elipse esticada.
                transform: Matrix4.diagonal3Values(
                  1 + (14 * ring) / halfW,
                  1 + (14 * ring) / halfH,
                  1,
                ),
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: AppRadius.pillAll,
                    border: Border.all(
                      color: colors.brasa,
                      width: 0.5 + 2 * (1 - ring),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      if (spread > 0)
        for (var i = 0; i < _sparkAngles.length; i++)
          IgnorePointer(
            child: Transform.translate(
              offset: () {
                final a = _sparkAngles[i] * math.pi / 180;
                return Offset(
                  math.cos(a) * (halfW * 0.85 + 18 * spread),
                  math.sin(a) * (halfH + 14 * spread),
                );
              }(),
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
          ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return LayoutBuilder(
      builder: (context, constraints) => AnimatedBuilder(
        animation: _controller,
        child: widget.child,
        builder: (context, child) {
          final t = _controller.value;
          return Stack(
            alignment: Alignment.center,
            clipBehavior: Clip.none,
            children: [
              Transform.scale(scale: _scale.transform(t), child: child),
              if (_controller.isAnimating)
                ..._burst(
                  t,
                  Size(
                    constraints.maxWidth.isFinite ? constraints.maxWidth : 0,
                    56,
                  ),
                  colors,
                ),
            ],
          );
        },
      ),
    );
  }
}
