import 'dart:math' as math;

import 'package:flutter/material.dart';

/// Formas de rabisco disponíveis.
enum ScribbleShape {
  /// Círculo torto em volta de algo — "olha isso aqui".
  circle,

  /// Sublinhado à mão, duas passadas.
  underline,

  /// Seta curta apontando para o conteúdo seguinte.
  arrow,

  /// Asterisco/estrela de marcador — nota, exceção, detalhe.
  asterisk,
}

/// **Rabisco → personalidade.**
///
/// O gesto humano dentro de uma interface impressa: um círculo torto em volta
/// de um número, um sublinhado que não é reto, uma seta apontando pro que
/// vem depois. É o elemento que mais rápido descamba pra infantil, então
/// vale a regra dura: **um rabisco por tela, no máximo**, e sempre apontando
/// para algo real — nunca como enfeite de canto vazio.
///
/// Desenhado com `drawPath` sobre um path fixo por forma (sem física, sem
/// animação contínua) e com `shouldRepaint` falso.
class ScribbleMark extends StatelessWidget {
  final ScribbleShape shape;
  final Color color;
  final double strokeWidth;

  /// Tamanho da caixa do rabisco. Para [ScribbleShape.circle] e
  /// [ScribbleShape.underline], geralmente é o tamanho do que está sendo
  /// marcado — use dentro de um `Stack`.
  final Size size;

  const ScribbleMark({
    super.key,
    required this.shape,
    required this.color,
    this.strokeWidth = 2.5,
    this.size = const Size(48, 48),
  });

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: RepaintBoundary(
        child: CustomPaint(
          size: size,
          painter: _ScribblePainter(
            shape: shape,
            color: color,
            strokeWidth: strokeWidth,
          ),
          willChange: false,
        ),
      ),
    );
  }
}

class _ScribblePainter extends CustomPainter {
  final ScribbleShape shape;
  final Color color;
  final double strokeWidth;

  const _ScribblePainter({
    required this.shape,
    required this.color,
    required this.strokeWidth,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;

    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = strokeWidth
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round
      ..isAntiAlias = true;

    switch (shape) {
      case ScribbleShape.circle:
        _circle(canvas, size, paint);
      case ScribbleShape.underline:
        _underline(canvas, size, paint);
      case ScribbleShape.arrow:
        _arrow(canvas, size, paint);
      case ScribbleShape.asterisk:
        _asterisk(canvas, size, paint);
    }
  }

  /// Elipse que não fecha e passa do ponto de partida — é o "erro" que faz
  /// parecer feito à mão.
  void _circle(Canvas canvas, Size size, Paint paint) {
    final w = size.width;
    final h = size.height;
    final path = Path()
      ..moveTo(w * 0.82, h * 0.16)
      ..cubicTo(w * 0.35, h * -0.04, w * -0.05, h * 0.34, w * 0.12, h * 0.66)
      ..cubicTo(w * 0.3, h * 1.02, w * 0.86, h * 1.04, w * 0.96, h * 0.62)
      ..cubicTo(w * 1.02, h * 0.36, w * 0.82, h * 0.16, w * 0.6, h * 0.1);
    canvas.drawPath(path, paint);
  }

  /// Duas passadas de caneta, a segunda mais curta e deslocada.
  void _underline(Canvas canvas, Size size, Paint paint) {
    final w = size.width;
    final h = size.height;
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.02, h * 0.42)
        ..quadraticBezierTo(w * 0.5, h * 0.86, w * 0.99, h * 0.34),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.14, h * 0.74)
        ..quadraticBezierTo(w * 0.52, h * 1.0, w * 0.88, h * 0.66),
      paint..color = color.withValues(alpha: 0.55),
    );
  }

  void _arrow(Canvas canvas, Size size, Paint paint) {
    final w = size.width;
    final h = size.height;
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.06, h * 0.24)
        ..cubicTo(w * 0.45, h * 0.1, w * 0.7, h * 0.4, w * 0.82, h * 0.78),
      paint,
    );
    canvas.drawPath(
      Path()
        ..moveTo(w * 0.58, h * 0.62)
        ..lineTo(w * 0.84, h * 0.84)
        ..lineTo(w * 0.94, h * 0.5),
      paint,
    );
  }

  void _asterisk(Canvas canvas, Size size, Paint paint) {
    final c = Offset(size.width / 2, size.height / 2);
    final r = size.shortestSide / 2;
    const angles = [0.3, 1.35, 2.4];
    for (final a in angles) {
      final dx = r * math.cos(a);
      final dy = r * math.sin(a);
      canvas.drawLine(c - Offset(dx, dy), c + Offset(dx, dy), paint);
    }
  }

  @override
  bool shouldRepaint(_ScribblePainter old) =>
      old.shape != shape ||
      old.color != color ||
      old.strokeWidth != strokeWidth;
}
