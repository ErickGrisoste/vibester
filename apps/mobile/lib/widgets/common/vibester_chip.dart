import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Pill de filtro/categoria — o controle de descoberta do Vibester.
///
/// Substitui formulário de filtro: o usuário escolhe direto na régua
/// horizontal, sem abrir tela nenhuma. Selecionado, o chip vira sólido em
/// `ambar` e o texto ganha peso; a transição é de cor e escala, não de
/// aparecer/sumir, pra o dedo não perder o alvo.
///
/// Área de toque garantida em 44px de altura mesmo com o pill visualmente
/// menor (§80 do briefing: nada de alvo minúsculo por elegância).
class VibesterChip extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  /// Emoji ou ícone à esquerda. Emoji vem dos interesses reais do produto
  /// (`interest_model.dart`), então é `String`, não `IconData`.
  final String? emoji;
  final IconData? icon;

  /// Contador opcional à direita (ex. quantidade de resultados). Só passe
  /// quando o número for real.
  final int? count;

  const VibesterChip({
    super.key,
    required this.label,
    this.selected = false,
    this.onTap,
    this.emoji,
    this.icon,
    this.count,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final foreground = selected ? colors.onAmbar : colors.textSecondary;

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: SizedBox(
          height: 44,
          child: Center(
            child: AnimatedContainer(
              duration: context.adaptiveMotion(AppMotion.micro),
              curve: AppMotion.standard,
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md + 2,
                vertical: AppSpacing.sm,
              ),
              decoration: BoxDecoration(
                color: selected ? colors.ambar : Colors.transparent,
                borderRadius: AppRadius.pillAll,
                border: Border.all(
                  color: selected ? colors.ambar : colors.outline,
                  width: AppStroke.hairline,
                ),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (emoji != null) ...[
                    Text(emoji!, style: const TextStyle(fontSize: 14)),
                    const SizedBox(width: AppSpacing.xs + 2),
                  ] else if (icon != null) ...[
                    Icon(icon, size: 14, color: foreground),
                    const SizedBox(width: AppSpacing.xs + 2),
                  ],
                  Text(
                    label,
                    style: context.typography.labelLarge.copyWith(
                      color: foreground,
                      fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                    ),
                  ),
                  if (count != null) ...[
                    const SizedBox(width: AppSpacing.sm),
                    Text(
                      '$count',
                      style: context.typography.monoMicro.copyWith(
                        color: selected
                            ? foreground.withValues(alpha: 0.75)
                            : colors.textDisabled,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Régua horizontal de chips com respiro nas bordas da tela.
///
/// Encapsula o padrão repetido de `SingleChildScrollView(horizontal)` +
/// padding — inclusive o detalhe fácil de esquecer: o padding tem que ser do
/// *conteúdo*, não do widget, senão o primeiro chip nasce colado na borda
/// quando a lista está rolada.
class VibesterChipRail extends StatelessWidget {
  final List<Widget> children;
  final EdgeInsets padding;

  const VibesterChipRail({
    super.key,
    required this.children,
    this.padding = const EdgeInsets.symmetric(horizontal: AppSpacing.screen),
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 44,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: padding,
        physics: const BouncingScrollPhysics(),
        itemCount: children.length,
        separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
        itemBuilder: (_, i) => children[i],
      ),
    );
  }
}
