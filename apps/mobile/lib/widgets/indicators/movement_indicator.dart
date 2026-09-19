import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Movimento do estabelecimento (`PlaceModel.nivelMovimento`, 0–5).
///
/// É o dado mais vivo do produto — a única coisa no app que responde "está
/// cheio agora?" — então ganha uma leitura própria: cinco barras que enchem
/// da esquerda pra direita, mais o rótulo em DM Mono quando há espaço.
///
/// O rótulo importa por acessibilidade: barras coloridas sozinhas comunicam
/// só para quem distingue a cor e conta os blocos. O texto é o que garante a
/// informação para todo mundo (§56 do briefing).
class MovimentoIndicator extends StatelessWidget {
  final int nivel;

  /// Exibe o rótulo textual ao lado das barras.
  final bool showLabel;

  /// Barras menores, para uso dentro de card compacto.
  final bool compact;

  const MovimentoIndicator({
    super.key,
    required this.nivel,
    this.showLabel = true,
    this.compact = false,
  });

  /// Leitura textual do nível. Derivada do dado, não inventada.
  static String labelFor(int nivel) => switch (nivel) {
    <= 0 => 'SEM DADO',
    1 => 'VAZIO',
    2 => 'TRANQUILO',
    3 => 'MOVIMENTADO',
    4 => 'CHEIO',
    _ => 'LOTADO',
  };

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    // Quanto mais cheio, mais quente: baixo fica no âmbar, alto vai pra
    // brasa. Ambas são da paleta — não há cor nova aqui.
    final active = nivel >= 4 ? colors.brasa : colors.ambar;
    final width = compact ? 9.0 : 13.0;
    final height = compact ? 5.0 : 6.0;

    return Semantics(
      label: 'Movimento: ${labelFor(nivel).toLowerCase()}',
      excludeSemantics: true,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (var i = 0; i < 5; i++)
            Padding(
              padding: const EdgeInsets.only(right: 3),
              child: AnimatedContainer(
                duration: context.adaptiveMotion(AppMotion.ui),
                curve: AppMotion.standard,
                width: width,
                height: height,
                decoration: BoxDecoration(
                  color: i < nivel
                      ? active.withValues(alpha: 1 - i * 0.12)
                      : colors.grey.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(1.5),
                ),
              ),
            ),
          if (showLabel) ...[
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                labelFor(nivel),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: context.typography.monoMicro.copyWith(
                  color: nivel >= 4 ? colors.brasa : colors.textSecondary,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
