import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Builders de transição de rota do Vibester — substituem os antigos
/// `_slideRoute`/`_fadeRoute`/`_scaleRoute` de `main.dart` por versões que
/// combinam fade + slide/scale sutil, para que a tela nova pareça uma
/// continuação da interface (ver seção 5 do briefing de motion), não um
/// efeito único isolado.
///
/// Todas respeitam "reduzir movimento" do sistema: com a flag ativa, a
/// duração cai para zero (nunca escondemos conteúdo atrás da transição).

/// Telas secundárias (settings, perfil, busca, listas) — desliza da direita
/// com um scale e fade sutis acompanhando, em vez de um slide puro e rígido.
PageRouteBuilder vibesterSlideRoute(Widget page, RouteSettings settings) {
  return PageRouteBuilder(
    settings: settings,
    transitionDuration: AppMotion.enterDuration,
    reverseTransitionDuration: AppMotion.exitDuration,
    pageBuilder: (_, _, _) => page,
    transitionsBuilder: (context, animation, _, child) {
      if (context.reduceMotion) return child;

      final curved = CurvedAnimation(parent: animation, curve: AppMotion.enter);
      return FadeTransition(
        opacity: curved,
        child: SlideTransition(
          position: Tween<Offset>(
            begin: const Offset(0.06, 0),
            end: Offset.zero,
          ).animate(curved),
          child: ScaleTransition(
            scale: Tween<double>(
              begin: AppMotion.scaleEnter,
              end: 1.0,
            ).animate(curved),
            child: child,
          ),
        ),
      );
    },
  );
}

/// Telas de contexto amplo (home, login, onboarding, auth) — fade com scale
/// sutil, sem deslocamento horizontal (não há "origem" lateral clara).
PageRouteBuilder vibesterFadeRoute(Widget page, RouteSettings settings) {
  return PageRouteBuilder(
    settings: settings,
    transitionDuration: AppMotion.enterDuration,
    reverseTransitionDuration: AppMotion.exitDuration,
    pageBuilder: (_, _, _) => page,
    transitionsBuilder: (context, animation, _, child) {
      if (context.reduceMotion) return child;

      final curved = CurvedAnimation(parent: animation, curve: AppMotion.enter);
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween<double>(
            begin: AppMotion.scaleEnter,
            end: 1.0,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}

/// Telas de detalhe (evento, estabelecimento, review, novo post) — scale mais
/// perceptível, criando a sensação de "o card virou a tela", complementado
/// por `Hero` nos widgets que participam da transição (imagem/título).
PageRouteBuilder vibesterDetailRoute(Widget page, RouteSettings settings) {
  return PageRouteBuilder(
    settings: settings,
    transitionDuration: AppMotion.enterDuration,
    reverseTransitionDuration: AppMotion.exitDuration,
    pageBuilder: (_, _, _) => page,
    transitionsBuilder: (context, animation, _, child) {
      if (context.reduceMotion) return child;

      final curved = CurvedAnimation(parent: animation, curve: AppMotion.enter);
      return FadeTransition(
        opacity: curved,
        child: ScaleTransition(
          scale: Tween<double>(
            begin: AppMotion.scaleDetailEnter,
            end: 1.0,
          ).animate(curved),
          child: child,
        ),
      );
    },
  );
}
