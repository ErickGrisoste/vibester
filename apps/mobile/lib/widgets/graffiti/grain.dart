import 'dart:ui' as ui;

import 'package:flutter/material.dart';

/// **Textura → atmosfera.**
///
/// Grão de xerox/concreto por cima de uma superfície. É o elemento mais
/// discreto da linguagem urbana do Vibester e o mais usado: aparece em fundos
/// de bloco e sobre fotos, sempre em opacidade baixa, e nunca deve ser
/// percebido conscientemente — só faz a superfície parar de parecer um
/// retângulo de cor chapada.
///
/// Custo: um único `drawPoints` por pintura (não um `drawCircle` por ponto),
/// com `shouldRepaint` falso e `RepaintBoundary` em volta — o grão não
/// re-pinta enquanto o tamanho não muda, então não entra no custo de scroll.
class Grain extends StatelessWidget {
  /// Conteúdo por baixo do grão. Se nulo, o grão preenche o espaço dado pelo
  /// pai (use dentro de um `Stack`/`Positioned.fill`).
  final Widget? child;

  /// Opacidade dos pontos. Acima de ~0.1 começa a sujar texto pequeno.
  final double opacity;

  /// Pontos por 10.000px². Densidade alta em área grande custa memória de
  /// lista, não de GPU — mantenha o padrão salvo motivo real.
  final double density;

  /// Cor do grão. Claro sobre fundo escuro (padrão), escuro sobre claro.
  final Color? color;

  /// Semente da distribuição. Fixa por padrão: o mesmo bloco tem sempre o
  /// mesmo grão entre rebuilds, senão a textura "pisca" a cada scroll.
  final int seed;

  const Grain({
    super.key,
    this.child,
    this.opacity = 0.05,
    this.density = 0.55,
    this.color,
    this.seed = 7,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveColor = color ?? Colors.white;
    return RepaintBoundary(
      child: CustomPaint(
        painter: _GrainPainter(
          color: effectiveColor.withValues(alpha: opacity),
          density: density,
          seed: seed,
        ),
        isComplex: true,
        willChange: false,
        child: child,
      ),
    );
  }
}

class _GrainPainter extends CustomPainter {
  final Color color;
  final double density;
  final int seed;

  const _GrainPainter({
    required this.color,
    required this.density,
    required this.seed,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;

    final count = ((size.width * size.height) / 10000 * density * 100)
        .clamp(40, 2200)
        .toInt();

    // LCG determinístico: mesma semente, mesma textura, sem depender de
    // dart:math.Random (que precisaria ser recriado a cada paint pra ser
    // estável, e alocaria mais).
    var state = seed * 1103515245 + 12345;
    int next() {
      state = (state * 1103515245 + 12345) & 0x7FFFFFFF;
      return state;
    }

    final points = <Offset>[];
    for (var i = 0; i < count; i++) {
      final x = (next() % 100000) / 100000 * size.width;
      final y = (next() % 100000) / 100000 * size.height;
      points.add(Offset(x, y));
    }

    canvas.drawPoints(
      ui.PointMode.points,
      points,
      Paint()
        ..color = color
        ..strokeWidth = 1.1
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_GrainPainter old) =>
      old.color != color || old.density != density || old.seed != seed;
}
