import 'package:flutter/material.dart';

/// **Pincel → separação.**
///
/// Substitui o `Divider` de 1px onde a divisão precisa ter voz: um traço de
/// tinta com espessura variável e leve ondulação, como se tivesse sido puxado
/// à mão. Usado para separar seções editoriais — nunca entre itens de uma
/// lista (ali a divisão é estrutural, e traço de tinta repetido trinta vezes
/// vira ruído).
///
/// Determinístico: a mesma [seed] gera sempre a mesma ondulação, então o
/// traço não muda de forma ao rolar a tela.
class BrushRule extends StatelessWidget {
  final Color color;

  /// Espessura máxima do traço (ele afina nas pontas).
  final double thickness;

  /// Altura da caixa — precisa acomodar a ondulação além da espessura.
  final double height;

  /// Largura. Nulo = ocupa a largura disponível.
  final double? width;

  final int seed;

  const BrushRule({
    super.key,
    required this.color,
    this.thickness = 5,
    this.height = 14,
    this.width,
    this.seed = 3,
  });

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: CustomPaint(
        size: Size(width ?? double.infinity, height),
        painter: _BrushRulePainter(
          color: color,
          thickness: thickness,
          seed: seed,
        ),
        willChange: false,
      ),
    );
  }
}

class _BrushRulePainter extends CustomPainter {
  final Color color;
  final double thickness;
  final int seed;

  const _BrushRulePainter({
    required this.color,
    required this.thickness,
    required this.seed,
  });

  static const _segments = 28;

  @override
  void paint(Canvas canvas, Size size) {
    if (size.isEmpty) return;

    final w = size.width;
    final midY = size.height / 2;
    final amplitude = 1.0 + (seed % 3);

    // Percorre a borda de cima da esquerda pra direita e a de baixo de volta,
    // fechando um único path. A distância entre elas é a espessura, que sobe
    // do começo pro meio e afina de novo no fim: é isso que faz o traço
    // parecer pincel, e não um retângulo.
    final top = <Offset>[];
    final bottom = <Offset>[];

    for (var i = 0; i <= _segments; i++) {
      final t = i / _segments;
      final x = w * t;
      final taper = (1 - (2 * t - 1).abs()).clamp(0.0, 1.0);
      // Ponta esquerda entra grossa e a direita sai fina — traço puxado.
      final half = (thickness / 2) * (0.25 + 0.75 * taper) * (1.15 - t * 0.3);
      final drift =
          amplitude * ((t * 5.5 + seed).remainder(2) - 1) * (0.4 + taper * 0.6);
      top.add(Offset(x, midY + drift - half));
      bottom.add(Offset(x, midY + drift + half));
    }

    final path = Path()..moveTo(top.first.dx, top.first.dy);
    for (final p in top.skip(1)) {
      path.lineTo(p.dx, p.dy);
    }
    for (final p in bottom.reversed) {
      path.lineTo(p.dx, p.dy);
    }
    path.close();

    canvas.drawPath(
      path,
      Paint()
        ..color = color
        ..style = PaintingStyle.fill
        ..isAntiAlias = true,
    );

    // Respingo: um ponto solto adiante da ponta, como tinta que escapou.
    canvas.drawCircle(
      Offset(w * 0.99, midY - thickness * 0.8),
      thickness * 0.2,
      Paint()..color = color.withValues(alpha: 0.65),
    );
  }

  @override
  bool shouldRepaint(_BrushRulePainter old) =>
      old.color != color || old.thickness != thickness || old.seed != seed;
}
