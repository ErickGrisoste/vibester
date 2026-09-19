import 'package:flutter/widgets.dart';

/// Tokens de espaçamento do Vibester.
///
/// Escala base 4, mas com saltos grandes propositais no topo ([xxl], [huge]):
/// o ritmo do app é "impacto → respiro → informação", e respiro de 12px não
/// é respiro. Prefira sempre um token a um número solto.
class AppSpacing {
  AppSpacing._();

  static const double xxs = 2;
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 24;
  static const double xxl = 32;
  static const double huge = 48;

  /// Margem lateral padrão de conteúdo. Toda tela usa esta, e nada encosta
  /// na borda física da tela por acidente.
  static const double screen = 20;

  /// Espaço reservado no fim de listas roláveis para o dock flutuante não
  /// cobrir o último item (altura do dock + folga).
  static const double dockGap = 108;

  /// Padding horizontal padrão de tela.
  static const EdgeInsets screenH = EdgeInsets.symmetric(horizontal: screen);
}

/// Raios do Vibester.
///
/// Deliberadamente **não** é tudo arredondado igual: a linguagem mistura
/// blocos retos (poster, lambe-lambe), cantos suaves (superfícies) e pills
/// (ações e tags). O raio comunica a natureza do elemento.
class AppRadius {
  AppRadius._();

  /// Poster / bloco impresso — quina viva. Cartazes não têm canto redondo.
  static const Radius none = Radius.zero;

  /// Sticker, tag, recorte de papel.
  static const double sticker = 4;

  /// Superfície pequena (chip retangular, thumb).
  static const double sm = 8;

  /// Superfície padrão (card, sheet interno, campo).
  static const double md = 14;

  /// Superfície grande (hero card, bottom sheet).
  static const double lg = 24;

  /// Pill (botão, chip de filtro, dock).
  static const double pill = 999;

  static BorderRadius get stickerAll => BorderRadius.circular(sticker);
  static BorderRadius get smAll => BorderRadius.circular(sm);
  static BorderRadius get mdAll => BorderRadius.circular(md);
  static BorderRadius get lgAll => BorderRadius.circular(lg);
  static BorderRadius get pillAll => BorderRadius.circular(pill);

  /// Topo arredondado, base reta — bottom sheets e painéis que sobem.
  static const BorderRadius sheet = BorderRadius.only(
    topLeft: Radius.circular(lg),
    topRight: Radius.circular(lg),
  );
}

/// Espessuras de traço. Um contorno de 1px é discreto; o Vibester usa
/// contorno como elemento gráfico, então tem também um traço "de caneta".
class AppStroke {
  AppStroke._();

  static const double hairline = 1;
  static const double regular = 1.5;
  static const double marker = 2.5;
}
