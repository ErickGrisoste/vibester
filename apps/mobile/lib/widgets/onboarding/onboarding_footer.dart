import 'dart:ui' show lerpDouble;

import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Rodapé do onboarding: progresso, "pular" e a ação principal.
///
/// Fica **fora** do `PageView`, fixo, enquanto as páginas passam por trás
/// dele — é uma das coisas que fazem o onboarding parecer uma experiência só,
/// e não quatro telas trocando. Por isso o progresso lê o `PageController`
/// direto: os traços crescem e mudam de cor acompanhando o dedo, em vez de
/// pular de estado quando a página assenta.
///
/// Na última página o "pular" recolhe e o CTA ocupa a linha inteira, com uma
/// entrada própria — é o elemento mais importante da tela.
class OnboardingFooter extends StatelessWidget {
  final PageController pages;
  final int page;
  final int total;
  final String ctaLabel;
  final VoidCallback onNext;

  /// Nulo recolhe o "pular" (na última página não há o que pular).
  final VoidCallback? onSkip;

  /// Pedido de permissão em andamento no CTA final.
  final bool busy;

  const OnboardingFooter({
    super.key,
    required this.pages,
    required this.page,
    required this.total,
    required this.ctaLabel,
    required this.onNext,
    this.onSkip,
    this.busy = false,
  });

  @override
  Widget build(BuildContext context) {
    final isLast = page == total - 1;

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _Progress(pages: pages, page: page, total: total),
          const SizedBox(height: AppSpacing.xl),
          Row(
            children: [
              AnimatedSize(
                duration: context.adaptiveMotion(AppMotion.ui),
                curve: AppMotion.standard,
                child: onSkip == null
                    ? const SizedBox(height: 48)
                    : Padding(
                        padding: const EdgeInsets.only(right: AppSpacing.md),
                        child: _TextAction(label: 'PULAR', onTap: onSkip!),
                      ),
              ),
              Expanded(
                child: _CtaEntrance(
                  emphasized: isLast,
                  child: VibesterButton(
                    label: ctaLabel,
                    onPressed: onNext,
                    state: busy
                        ? VibesterButtonState.loading
                        : VibesterButtonState.idle,
                    icon: isLast ? Icons.arrow_forward_rounded : null,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Traços que crescem, não bolinhas — combina com o traço de marcador do
/// resto do app. O traço de cada página interpola largura e cor pela
/// distância até a posição atual do `PageController`.
class _Progress extends StatelessWidget {
  final PageController pages;
  final int page;
  final int total;

  const _Progress({
    required this.pages,
    required this.page,
    required this.total,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      label: 'Página ${page + 1} de $total',
      excludeSemantics: true,
      child: Row(
        children: [
          AnimatedBuilder(
            animation: pages,
            builder: (context, _) {
              final position = pages.hasClients && pages.position.haveDimensions
                  ? pages.page ?? page.toDouble()
                  : page.toDouble();

              return Row(
                children: [
                  for (var i = 0; i < total; i++)
                    Builder(
                      builder: (_) {
                        final t = (1 - (position - i).abs()).clamp(0.0, 1.0);
                        return Container(
                          margin: const EdgeInsets.only(right: AppSpacing.sm),
                          height: 3,
                          width: lerpDouble(12, 28, t),
                          decoration: BoxDecoration(
                            color: Color.lerp(colors.hairline, colors.ambar, t),
                            borderRadius: BorderRadius.circular(2),
                          ),
                        );
                      },
                    ),
                ],
              );
            },
          ),
          const Spacer(),
          Text(
            '${(page + 1).toString().padLeft(2, '0')} / '
            '${total.toString().padLeft(2, '0')}',
            style: context.typography.monoMicro.copyWith(
              color: colors.textDisabled,
            ),
          ),
        ],
      ),
    );
  }
}

/// Quando o CTA vira o final, ele "chega": sobe um pouco, cresce até o
/// tamanho e assenta com overshoot leve. Só na ida — voltar da última página
/// não precisa de cerimônia.
class _CtaEntrance extends StatefulWidget {
  final bool emphasized;
  final Widget child;

  const _CtaEntrance({required this.emphasized, required this.child});

  @override
  State<_CtaEntrance> createState() => _CtaEntranceState();
}

class _CtaEntranceState extends State<_CtaEntrance>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: AppMotion.expressive,
    value: 1,
  );

  @override
  void didUpdateWidget(covariant _CtaEntrance oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.emphasized && !oldWidget.emphasized) {
      if (AppMotion.reduceMotion(context)) return;
      _controller.forward(from: 0);
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
      child: widget.child,
      builder: (context, child) {
        final t = AppMotion.emphasis.transform(_controller.value);
        return Transform.translate(
          offset: Offset(0, (1 - t) * AppMotion.distanceSmall),
          child: Transform.scale(scale: lerpDouble(0.94, 1, t), child: child),
        );
      },
    );
  }
}

class _TextAction extends StatelessWidget {
  final String label;
  final VoidCallback onTap;

  const _TextAction({required this.label, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return VibesterPressable(
      onTap: onTap,
      borderRadius: AppRadius.pillAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.lg,
        ),
        child: Text(
          label,
          style: context.typography.monoMicro.copyWith(
            color: context.colors.textMuted,
          ),
        ),
      ),
    );
  }
}
