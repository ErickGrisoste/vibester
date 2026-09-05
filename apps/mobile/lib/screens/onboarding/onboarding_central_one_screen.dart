import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

// ===========================================================================
// ONBOARDING 2 — SOCIAL
// Topo: Voltar (esquerda). Rodapé: Pular (esquerda) + Próximo (direita).
// ===========================================================================
class OnboardingCentralOneScreen extends StatefulWidget {
  /// Avanca para a tela 3.
  final VoidCallback onNext;

  /// Volta para a tela 1.
  final VoidCallback onBack;

  /// Pula direto para a tela 3.
  final VoidCallback onSkip;

  const OnboardingCentralOneScreen({
    super.key,
    required this.onNext,
    required this.onBack,
    required this.onSkip,
  });

  @override
  State<OnboardingCentralOneScreen> createState() =>
      _OnboardingCentralOneScreenState();
}

class _OnboardingCentralOneScreenState
    extends State<OnboardingCentralOneScreen> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.noturno,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // ---------- topo: voltar ----------
              SizedBox(
                height: 48,
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: _BackButton(onTap: widget.onBack),
                ),
              ),

              // ---------- área da imagem ----------
              const Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: _ImagePlaceholder(
                    label: 'feed do app',
                    icon: Icons.dynamic_feed_outlined,
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // ---------- título ----------
              Text(
                'Veja como tá antes de sair de casa',
                style: TextStyle(
                  color: context.colors.textPrimary,
                  fontSize: 26,
                  fontWeight: FontWeight.bold,
                  height: 1.15,
                  letterSpacing: -0.4,
                ),
              ),

              const SizedBox(height: 26),

              // ---------- texto explicativo ----------
              Text(
                'Fotos, vídeos e lotação em tempo real, direto dos lugares.',
                style: TextStyle(
                  color: context.colors.grey,
                  fontSize: 14.5,
                  height: 1.55,
                ),
              ),

              const SizedBox(height: 26),

              // ---------- indicador de página ----------
              const _PageDots(current: 1, total: 3),

              const SizedBox(height: 22),

              // ---------- rodapé ----------
              Row(
                children: [
                  TextButton(
                    onPressed: widget.onSkip,
                    style: TextButton.styleFrom(
                      foregroundColor: context.colors.grey,
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 12,
                      ),
                    ),
                    child: const Text(
                      'Pular',
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                  const Spacer(),
                  _GradientButton(label: 'Próximo', onTap: widget.onNext),
                ],
              ),

              const SizedBox(height: 16),
            ],
          ),
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// PLACEHOLDER DE IMAGEM
// ---------------------------------------------------------------------------
class _ImagePlaceholder extends StatelessWidget {
  final String label;
  final IconData icon;

  const _ImagePlaceholder({required this.label, required this.icon});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: context.colors.navy.withOpacity(0.45),
        borderRadius: BorderRadius.circular(22),
      ),
      child: CustomPaint(
        painter: _DashedBorderPainter(
          color: context.colors.ambar.withOpacity(0.35),
          radius: 22,
        ),
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              GradientMask(child: Icon(icon, size: 40)),
              const SizedBox(height: 12),
              Text(
                label,
                style: TextStyle(
                  color: context.colors.grey,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DashedBorderPainter extends CustomPainter {
  final Color color;
  final double radius;
  final double dash;
  final double gap;

  _DashedBorderPainter({
    required this.color,
    required this.radius,
    this.dash = 8,
    this.gap = 6,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rrect = RRect.fromRectAndRadius(
      Offset.zero & size,
      Radius.circular(radius),
    );
    final source = Path()..addRRect(rrect);
    final dashed = Path();

    for (final metric in source.computeMetrics()) {
      double distance = 0;
      while (distance < metric.length) {
        final next = distance + dash;
        dashed.addPath(
          metric.extractPath(distance, next.clamp(0.0, metric.length)),
          Offset.zero,
        );
        distance = next + gap;
      }
    }

    canvas.drawPath(
      dashed,
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = 1.4,
    );
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

// ---------------------------------------------------------------------------
// INDICADOR DE PÁGINA
// ---------------------------------------------------------------------------
class _PageDots extends StatelessWidget {
  final int current;
  final int total;

  const _PageDots({required this.current, required this.total});

  @override
  Widget build(BuildContext context) {
    return Row(
      children: List.generate(total, (i) {
        final active = i == current;
        return Container(
          margin: const EdgeInsets.only(right: 7),
          width: active ? 22 : 7,
          height: 7,
          decoration: BoxDecoration(
            gradient: active ? context.colors.gradient : null,
            color: active ? null : context.colors.grey.withOpacity(0.28),
            borderRadius: BorderRadius.circular(4),
          ),
        );
      }),
    );
  }
}

// ---------------------------------------------------------------------------
// BOTÃO VOLTAR
// ---------------------------------------------------------------------------
class _BackButton extends StatelessWidget {
  final VoidCallback onTap;

  const _BackButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(12),
      onTap: onTap,
      child: Container(
        width: 42,
        height: 42,
        decoration: BoxDecoration(
          color: context.colors.navy,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(
            color: context.colors.ambar.withOpacity(0.3),
            width: 1.2,
          ),
        ),
        child: Icon(
          Icons.arrow_back_rounded,
          size: 19,
          color: context.colors.textPrimary,
        ),
      ),
    );
  }
}

// ---------------------------------------------------------------------------
// BOTÃO PRIMÁRIO EM GRADIENTE
// ---------------------------------------------------------------------------
class _GradientButton extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _GradientButton({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Container(
        decoration: BoxDecoration(
          gradient: context.colors.gradient,
          boxShadow: [
            BoxShadow(
              color: context.colors.ambar.withOpacity(0.35),
              blurRadius: 16,
              offset: const Offset(0, 5),
            ),
          ],
        ),
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 30, vertical: 15),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14.5,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(width: 7),
                const Icon(
                  Icons.arrow_forward_rounded,
                  size: 17,
                  color: Colors.white,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}