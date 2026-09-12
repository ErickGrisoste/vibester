import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Botão/card "clicável" com física de mola de verdade (não uma curva
/// aproximada): comprime no toque (`AppMotion.springPress`) e volta com um
/// pequeno overshoot ao soltar (`AppMotion.springBouncy`) — seção 5 do
/// briefing de motion 2.0.
///
/// Substitui o padrão repetido `Material(color: transparent, child: InkWell(...))`
/// usado nos botões e cards tocáveis — mantém o ripple do Material (o
/// "brilho" pedido na seção 5) e adiciona o squash por cima.
class VibesterPressable extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final BorderRadius? borderRadius;
  final Color? splashColor;
  final Color? materialColor;

  /// Escala ao pressionar. Padrão da seção 5 (1 → 0.94).
  final double pressScale;

  const VibesterPressable({
    super.key,
    required this.child,
    this.onTap,
    this.borderRadius,
    this.splashColor,
    this.materialColor = Colors.transparent,
    this.pressScale = 0.94,
  });

  @override
  State<VibesterPressable> createState() => _VibesterPressableState();
}

class _VibesterPressableState extends State<VibesterPressable>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    value: 1.0,
    lowerBound: 0.0,
    upperBound: 1.3,
  );

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _animateTo(double target, SpringDescription spring) {
    if (context.reduceMotion) {
      _controller.value = target;
      return;
    }
    _controller.animateWith(
      SpringSimulation(spring, _controller.value, target, 0),
    );
  }

  void _setPressed(bool pressed) {
    _animateTo(
      pressed ? widget.pressScale : 1.0,
      pressed ? AppMotion.springPress : AppMotion.springBouncy,
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) =>
          Transform.scale(scale: _controller.value, child: child),
      child: Material(
        color: widget.materialColor,
        borderRadius: widget.borderRadius,
        child: InkWell(
          borderRadius: widget.borderRadius,
          splashColor: widget.splashColor,
          onTap: widget.onTap,
          onHighlightChanged: _setPressed,
          child: widget.child,
        ),
      ),
    );
  }
}
