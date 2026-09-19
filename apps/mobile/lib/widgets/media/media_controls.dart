import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Botão redondo das telas de mídia (fechar, flash, galeria, trocar lente).
///
/// Fundo translúcido de `surfaceRaised` para ler sobre qualquer foto, alvo de
/// toque de pelo menos 44px e rótulo acessível obrigatório — é só ícone.
class MediaRoundButton extends StatelessWidget {
  final IconData icon;
  final String semanticLabel;
  final VoidCallback? onTap;
  final double size;

  const MediaRoundButton({
    super.key,
    required this.icon,
    required this.semanticLabel,
    required this.onTap,
    this.size = 48,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final enabled = onTap != null;

    return Semantics(
      button: true,
      enabled: enabled,
      label: semanticLabel,
      child: AnimatedOpacity(
        opacity: enabled ? 1 : 0.35,
        duration: context.adaptiveMotion(AppMotion.micro),
        child: VibesterPressable(
          onTap: onTap,
          borderRadius: AppRadius.pillAll,
          materialColor: colors.surfaceRaised.withValues(alpha: 0.72),
          child: SizedBox(
            width: size,
            height: size,
            child: Icon(icon, size: size * 0.46, color: colors.textPrimary),
          ),
        ),
      ),
    );
  }
}

/// Obturador — foto e vídeo.
///
/// Foto: anel claro com o miolo em `ambar` — o único ponto de cor da tela de
/// câmera, porque é a única ação que importa. Vídeo: o miolo passa a `brasa`
/// (a cor de "ao vivo" do produto) e, gravando, vira um quadrado de parar
/// enquanto o anel se preenche até o limite de duração.
///
/// Comprime com mola ao tocar; durante a captura de foto o miolo recolhe e o
/// anel acende, para a pessoa saber que a foto está sendo tirada mesmo quando
/// o aparelho demora. Sem animação em loop de repouso: o design system proíbe
/// loop infinito de fundo, e a câmera precisa parecer rápida, não ansiosa.
class ShutterButton extends StatefulWidget {
  final VoidCallback? onPressed;
  final bool capturing;
  final bool video;
  final bool recording;

  /// Quanto da duração máxima já foi gravado, de 0 a 1.
  final double progress;

  final double size;

  const ShutterButton({
    super.key,
    required this.onPressed,
    this.capturing = false,
    this.video = false,
    this.recording = false,
    this.progress = 0,
    this.size = 76,
  });

  @override
  State<ShutterButton> createState() => _ShutterButtonState();
}

class _ShutterButtonState extends State<ShutterButton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _press;

  @override
  void initState() {
    super.initState();
    _press = AnimationController(
      vsync: this,
      value: 1,
      lowerBound: 0,
      upperBound: 1.2,
    );
  }

  @override
  void dispose() {
    _press.dispose();
    super.dispose();
  }

  void _springTo(double target, SpringDescription spring) {
    if (context.reduceMotion) {
      _press.value = target;
      return;
    }
    _press.animateWith(SpringSimulation(spring, _press.value, target, 0));
  }

  String get _label {
    if (!widget.video) return 'Tirar foto';
    return widget.recording ? 'Parar gravação' : 'Gravar vídeo';
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final enabled = widget.onPressed != null && !widget.capturing;
    final micro = context.adaptiveMotion(AppMotion.micro);
    final fill = widget.video ? colors.brasa : colors.ambar;
    final ring = widget.capturing && !widget.video
        ? colors.ambar
        : widget.recording
        ? colors.hairline
        : colors.textPrimary;
    final innerSize = widget.recording ? widget.size * 0.36 : widget.size - 18;

    return Semantics(
      button: true,
      enabled: enabled,
      label: _label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: enabled
            ? (_) => _springTo(0.9, AppMotion.springPress)
            : null,
        onTapCancel: () => _springTo(1, AppMotion.springBouncy),
        onTapUp: enabled
            ? (_) {
                _springTo(1, AppMotion.springBouncy);
                widget.onPressed!();
              }
            : null,
        child: AnimatedOpacity(
          opacity: widget.onPressed == null ? 0.4 : 1,
          duration: micro,
          child: ScaleTransition(
            scale: _press,
            child: SizedBox(
              width: widget.size,
              height: widget.size,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  AnimatedContainer(
                    duration: micro,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border: Border.all(color: ring, width: 4),
                    ),
                  ),
                  if (widget.recording)
                    CustomPaint(
                      size: Size.square(widget.size),
                      painter: _RingProgress(
                        progress: widget.progress,
                        color: colors.brasa,
                      ),
                    ),
                  AnimatedScale(
                    scale: widget.capturing && !widget.video ? 0.72 : 1,
                    duration: micro,
                    curve: AppMotion.standard,
                    child: AnimatedContainer(
                      duration: context.adaptiveMotion(AppMotion.ui),
                      curve: AppMotion.standard,
                      width: innerSize,
                      height: innerSize,
                      decoration: BoxDecoration(
                        color: fill,
                        borderRadius: BorderRadius.circular(
                          widget.recording ? AppRadius.sticker : innerSize / 2,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Arco do tempo gravado sobre o anel do obturador.
class _RingProgress extends CustomPainter {
  final double progress;
  final Color color;

  const _RingProgress({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;
    canvas.drawArc(
      rect.deflate(2),
      -math.pi / 2,
      2 * math.pi * progress.clamp(0.0, 1.0),
      false,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 4
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_RingProgress old) =>
      old.progress != progress || old.color != color;
}
