import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Micro shake horizontal (seção 25) — dispara sempre que [trigger] muda de
/// valor (ex.: a cada vez que um estado de erro é atingido, mesmo que seja o
/// mesmo erro de novo). Rápido, pequeno, não repete sozinho.
class VibesterShake extends StatefulWidget {
  final Widget child;
  final Object? trigger;

  const VibesterShake({super.key, required this.child, required this.trigger});

  @override
  State<VibesterShake> createState() => _VibesterShakeState();
}

class _VibesterShakeState extends State<VibesterShake>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: AppMotion.ui,
  );
  late Object? _lastTrigger = widget.trigger;

  @override
  void didUpdateWidget(covariant VibesterShake old) {
    super.didUpdateWidget(old);
    if (widget.trigger != _lastTrigger) {
      _lastTrigger = widget.trigger;
      if (!context.reduceMotion) _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        // 0 → -4 → 4 → -2 → 0, amortecendo rápido.
        final t = _controller.value;
        final offset =
            8 *
            (t < 0.25
                ? -t / 0.25
                : t < 0.5
                ? -1 + (t - 0.25) / 0.25 * 2
                : t < 0.75
                ? 1 - (t - 0.5) / 0.25 * 1.5
                : 0.5 - (t - 0.75) / 0.25 * 0.5);
        return Transform.translate(offset: Offset(offset, 0), child: child);
      },
      child: widget.child,
    );
  }
}
