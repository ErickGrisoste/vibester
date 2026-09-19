import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Placeholder de carregamento do Vibester.
///
/// Substitui o `CircularProgressIndicator` centralizado como solução padrão:
/// uma roda girando não diz nada sobre o que está vindo, enquanto o esqueleto
/// já desenha a forma do conteúdo — a tela não "pula" quando os dados chegam,
/// porque a caixa já estava lá do tamanho certo.
///
/// O brilho é uma faixa diagonal atravessando a caixa (`LinearGradient`
/// deslocado por um `AnimationController`), sem `BackdropFilter` nem sombra —
/// custo de um `DecoratedBox` por frame. A animação só existe enquanto o
/// esqueleto existe, então não é uma animação infinita esquecida na tela.
class VibesterSkeleton extends StatefulWidget {
  final double? width;

  /// Nulo = ocupa a altura disponível (útil como placeholder de imagem, que
  /// já tem as dimensões definidas pelo pai).
  final double? height;

  final BorderRadius? borderRadius;

  const VibesterSkeleton({
    super.key,
    this.width,
    this.height,
    this.borderRadius,
  });

  @override
  State<VibesterSkeleton> createState() => _VibesterSkeletonState();
}

class _VibesterSkeletonState extends State<VibesterSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _shimmer = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // Sem brilho quando o sistema pede redução de movimento: a caixa fica
    // parada, o conteúdo continua sendo comunicado pela forma.
    if (!context.reduceMotion && !_shimmer.isAnimating) _shimmer.repeat();
  }

  @override
  void dispose() {
    _shimmer.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final base = context.colors.surface;
    final highlight = context.colors.grey.withValues(alpha: 0.10);
    final radius = widget.borderRadius ?? AppRadius.smAll;

    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _shimmer,
        builder: (context, _) {
          final t = _shimmer.value;
          return Container(
            width: widget.width,
            height: widget.height,
            decoration: BoxDecoration(
              color: base,
              borderRadius: radius,
              gradient: LinearGradient(
                begin: Alignment(-1.6 + t * 3.2, -0.4),
                end: Alignment(-0.6 + t * 3.2, 0.4),
                colors: [base, highlight, base],
              ),
            ),
          );
        },
      ),
    );
  }
}

/// Pilha de linhas de texto em esqueleto, com larguras diferentes.
class VibesterSkeletonLines extends StatelessWidget {
  final int lines;
  final double spacing;

  const VibesterSkeletonLines({
    super.key,
    this.lines = 2,
    this.spacing = AppSpacing.sm,
  });

  @override
  Widget build(BuildContext context) {
    const factors = [1.0, 0.82, 0.64, 0.9];
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < lines; i++) ...[
          if (i > 0) SizedBox(height: spacing),
          FractionallySizedBox(
            widthFactor: factors[i % factors.length],
            child: VibesterSkeleton(
              height: 11,
              borderRadius: BorderRadius.circular(4),
            ),
          ),
        ],
      ],
    );
  }
}
