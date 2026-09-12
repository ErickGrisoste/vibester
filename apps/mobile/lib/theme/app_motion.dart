import 'package:flutter/material.dart';

/// Tokens de motion do Vibester: duração, curva, distância e escala.
///
/// Como `AppTypography`, não é um `ThemeExtension` — motion não varia entre
/// tema claro/escuro. Acessado via `context.motion` (`theme_extensions.dart`).
class AppMotion {
  AppMotion._();

  // ---------------------------------------------------------------------
  // Duração
  // ---------------------------------------------------------------------

  /// Feedback de toque (botões, likes, checkboxes). Precisa acontecer antes
  /// da ação terminar.
  static const fast = Duration(milliseconds: 150);

  /// Padrão para a maioria das microinterações (navbar, filtros, chips).
  static const normal = Duration(milliseconds: 250);

  /// Transições maiores (bottom sheets, modais, reveals).
  static const slow = Duration(milliseconds: 400);

  /// Transição entre telas — mesmo valor já validado no onboarding
  /// (`onboarding_screen.dart`).
  static const pageTransition = Duration(milliseconds: 320);

  /// Passo de stagger entre itens de uma lista (30–70ms recomendado).
  static const staggerStep = Duration(milliseconds: 45);

  /// Duração de entrada de cada item individual num stagger.
  static const staggerItem = Duration(milliseconds: 320);

  /// Fade de imagens de rede ao carregar.
  static const imageFade = Duration(milliseconds: 220);

  /// Sequência de favoritar/curtir (encolhe → cresce → overshoot → assenta),
  /// dentro da faixa 250–450ms pedida na seção 6 do briefing 2.0.
  static const favorite = Duration(milliseconds: 380);

  // ---------------------------------------------------------------------
  // Curvas
  // ---------------------------------------------------------------------

  /// Elementos entrando na tela (aparecer).
  static const enter = Curves.easeOutCubic;

  /// Elementos saindo da tela (desaparecer).
  static const exit = Curves.easeInCubic;

  /// Transformações de estado (padrão geral: toggle, resize, cor).
  static const standard = Curves.easeInOutCubic;

  /// Energia/personalidade — usar com moderação (nunca em tudo).
  static const emphasis = Curves.easeOutBack;

  // ---------------------------------------------------------------------
  // Distância (slide / translateY)
  // ---------------------------------------------------------------------

  static const distanceSmall = 8.0;
  static const distanceMedium = 16.0;
  static const distanceLarge = 32.0;

  // ---------------------------------------------------------------------
  // Escala
  // ---------------------------------------------------------------------

  /// Escala ao pressionar (botões, cards tocáveis).
  static const scalePress = 0.97;

  /// Escala inicial de elementos entrando (telas, cards, listas).
  static const scaleEnter = 0.985;

  /// Escala inicial de telas de detalhe (evento, estabelecimento) — mais
  /// perceptível que [scaleEnter] para reforçar "entrei neste item".
  static const scaleDetailEnter = 0.92;

  /// Escala de pico em microinterações de destaque (like, favorito).
  static const scaleEmphasis = 1.15;

  // ---------------------------------------------------------------------
  // Hierarquia (seção 37 do briefing 2.0) — três níveis de duração conforme
  // o peso da interação. Prefira estes a valores soltos.
  // ---------------------------------------------------------------------

  /// Botões, ícones, toggles.
  static const micro = Duration(milliseconds: 140);

  /// Cards, navegação, sheets, filtros.
  static const ui = Duration(milliseconds: 280);

  /// Onboarding, Hero, celebrações, momentos especiais.
  static const expressive = Duration(milliseconds: 550);

  // ---------------------------------------------------------------------
  // Assimetria entrada/saída (seção 36) — entradas mais expressivas,
  // saídas rápidas para não atrasar a navegação.
  // ---------------------------------------------------------------------

  static const enterDuration = Duration(milliseconds: 350);
  static const exitDuration = Duration(milliseconds: 180);

  // ---------------------------------------------------------------------
  // Spring (seção 3) — física real (massa-mola-amortecimento), não só uma
  // curva aproximada. Use com [VibesterSpring]/[VibesterPressable].
  // ---------------------------------------------------------------------

  /// Toque em botões/cards — resposta rápida, quase sem overshoot.
  static const springPress = SpringDescription(
    mass: 1,
    stiffness: 500,
    damping: 28,
  );

  /// Release/entrada de elementos — overshoot perceptível, assentamento
  /// visível (favoritar, cards entrando, modais).
  static const springBouncy = SpringDescription(
    mass: 1,
    stiffness: 300,
    damping: 14,
  );

  /// Indicador de navbar/tabs viajando entre posições — suave, sem bounce.
  static const springSmooth = SpringDescription(
    mass: 1,
    stiffness: 400,
    damping: 32,
  );

  // ---------------------------------------------------------------------
  // Reduce motion
  // ---------------------------------------------------------------------

  /// Verifica se o sistema operacional pede redução de movimento
  /// (Configurações > Acessibilidade > Reduzir Movimento).
  static bool reduceMotion(BuildContext context) =>
      MediaQuery.of(context).disableAnimations;

  /// Aplica a duração normal, ou [Duration.zero] se o usuário pediu redução
  /// de movimento — nunca esconde conteúdo atrás da animação, só encurta.
  static Duration adaptive(BuildContext context, Duration duration) =>
      reduceMotion(context) ? Duration.zero : duration;
}
