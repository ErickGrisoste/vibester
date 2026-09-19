import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Toque duplo na mídia do post para curtir, com um coração grande que
/// estoura no centro, assenta e sobe sumindo.
///
/// Só curte, nunca descurte: é o gesto que o usuário já conhece de outras
/// redes, e um toque duplo acidental não pode desfazer uma curtida. Quem
/// decide se a chamada à API é necessária (post já curtido, sem sessão) é
/// [onLike]; o coração aparece de qualquer forma, como confirmação do gesto.
///
/// O toque simples continua chegando ao filho (play/pause do vídeo), só que
/// depois da janela de toque duplo — é o custo de ter os dois gestos na
/// mesma área.
class DoubleTapLike extends StatefulWidget {
  final Widget child;
  final VoidCallback onLike;

  const DoubleTapLike({super.key, required this.child, required this.onLike});

  @override
  State<DoubleTapLike> createState() => _DoubleTapLikeState();
}

class _DoubleTapLikeState extends State<DoubleTapLike>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  static final _scale = TweenSequence<double>([
    TweenSequenceItem(
      tween: Tween(
        begin: 0.0,
        end: 1.2,
      ).chain(CurveTween(curve: Curves.easeOut)),
      weight: 28,
    ),
    TweenSequenceItem(
      tween: Tween(
        begin: 1.2,
        end: 1.0,
      ).chain(CurveTween(curve: Curves.easeInOutCubic)),
      weight: 20,
    ),
    TweenSequenceItem(tween: ConstantTween(1.0), weight: 30),
    TweenSequenceItem(
      tween: Tween(
        begin: 1.0,
        end: 0.85,
      ).chain(CurveTween(curve: Curves.easeIn)),
      weight: 22,
    ),
  ]);

  /// Trecho final em que o coração sobe e desaparece.
  static const _exit = Interval(0.78, 1, curve: Curves.easeIn);

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: AppMotion.expressive + AppMotion.ui,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleDoubleTap() {
    widget.onLike();
    // Sem animação, o feedback fica por conta do coração pequeno trocando.
    if (context.reduceMotion) return;
    _controller.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onDoubleTap: _handleDoubleTap,
      child: Stack(
        fit: StackFit.expand,
        children: [
          widget.child,
          IgnorePointer(
            child: LayoutBuilder(
              builder: (context, constraints) {
                final size = constraints.biggest.shortestSide * 0.3;
                return AnimatedBuilder(
                  animation: _controller,
                  builder: (context, _) {
                    if (!_controller.isAnimating) {
                      return const SizedBox.shrink();
                    }
                    final t = _controller.value;
                    final exit = _exit.transform(t);
                    return Center(
                      child: Opacity(
                        opacity: 1 - exit,
                        child: Transform.translate(
                          offset: Offset(0, -size * 0.3 * exit),
                          child: Transform.scale(
                            scale: _scale.transform(t),
                            child: Icon(
                              Icons.favorite,
                              size: size,
                              color: colors.brasa,
                              shadows: [
                                Shadow(
                                  color: colors.scrim.withValues(alpha: 0.35),
                                  blurRadius: 24,
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
