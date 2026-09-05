import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

// ===========================================================================
// ONBOARDING 1 — DESCOBERTA
// Rodapé: Pular (esquerda) + Próximo (direita). Sem botão voltar.
// ===========================================================================
class InitialOnboardingScreen extends StatefulWidget {
  /// Avanca para a tela 2.
  final VoidCallback onNext;

  /// Pula direto para a tela 3.
  final VoidCallback onSkip;

  const InitialOnboardingScreen({
    super.key,
    required this.onNext,
    required this.onSkip,
  });

  @override
  State<InitialOnboardingScreen> createState() =>
      _InitialOnboardingScreenState();
}

class _InitialOnboardingScreenState extends State<InitialOnboardingScreen> {
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
              // ---------- topo (vazio nesta tela) ----------
              const SizedBox(height: 48),

              // ---------- área da imagem ----------
              const Expanded(
                child: Padding(
                  padding: EdgeInsets.symmetric(vertical: 12),
                  child: _ImagePlaceholder(
                    label: 'mapa com os locais',
                    icon: Icons.map_outlined,
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // ---------- título ----------
              Text(
                'Os melhores rolês perto de você',
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
                'Bares, baladas e eventos por categoria — tudo num lugar só.',
                style: TextStyle(
                  color: context.colors.grey,
                  fontSize: 14.5,
                  height: 1.55,
                ),
              ),

              const SizedBox(height: 26),

              // ---------- indicador de página ----------
              const _PageDots(current: 0, total: 3),

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