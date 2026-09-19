import 'package:flutter/widgets.dart';

/// Medidas e tempos da navegação principal.
///
/// Ficam num arquivo só porque a navbar aparece em todas as telas e é feita de
/// muitos números que precisam concordar entre si: a profundidade da
/// concavidade depende do raio do recorte, que depende do tamanho do botão
/// central, que depende da altura da barra. Espalhar isso pelos widgets
/// garantiria que um ajuste visual quebrasse a geometria em outro lugar.
///
/// Os valores foram calibrados no aparelho; trate-os como ponto de partida
/// para refino visual, não como constantes sagradas.
class NavbarTokens {
  NavbarTokens._();

  // ---------------------------------------------------------------------
  // Geometria
  // ---------------------------------------------------------------------

  /// Altura da barra em si (sem o botão central, que sobe acima dela).
  ///
  /// Precisa acomodar ícone + rótulo do destino ativo + traço de marcador com
  /// folga: em 66px o rótulo encostava na borda inferior da pill.
  static const double height = 72;

  /// Margem interna da fileira de destinos.
  ///
  /// Sem ela o halo do primeiro e do último item bate na curva da pill e é
  /// cortado pelo recorte, virando um retângulo com aresta viva em vez de uma
  /// luz difusa.
  static const double contentInset = 10;

  /// Margem lateral: a barra é uma camada flutuante, não encosta na tela.
  static const double horizontalMargin = 16;

  /// Folga abaixo da barra quando o aparelho não tem gesture bar.
  static const double bottomMargin = 12;

  /// Diâmetro do botão central.
  ///
  /// Cabe dentro de [height] com folga: o botão é um elemento da barra, não
  /// um FAB apoiado nela. Nada transborda, então a área tocável é inteira —
  /// some por completo o risco de a metade de cima ficar visível mas morta ao
  /// toque, que é o defeito clássico do padrão sobreposto.
  static const double centerSize = 52;

  /// Largura do vão reservado ao botão no meio da fileira. A folga extra
  /// impede que ele encoste nos destinos vizinhos.
  static const double centerSlot = centerSize + 18;

  /// Espessura do contorno da barra.
  static const double borderWidth = 1;

  static const double iconSize = 23;

  /// Alvo mínimo de toque de cada item (§26 do briefing e WCAG).
  static const double minTouchTarget = 44;

  // ---------------------------------------------------------------------
  // Material
  // ---------------------------------------------------------------------

  /// Desfoque do vidro. Um `BackdropFilter` só, e moderado: a navbar fica
  /// sobre listas que rolam, e cada frame de scroll repinta o filtro.
  static const double blurSigma = 16;

  /// Opacidade da superfície por cima do desfoque. Sem isso o vidro fica
  /// transparente demais e o ícone inativo some sobre foto clara.
  static const double surfaceOpacity = 0.72;

  /// Intensidade do halo do item ativo e do brilho do botão central.
  static const double glowOpacity = 0.28;

  /// Brilho ambiente difuso atrás da barra inteira.
  static const double ambientGlowOpacity = 0.16;

  /// Grão da identidade — quase imperceptível, só para o vidro não parecer
  /// glassmorphism genérico.
  static const double grainOpacity = 0.035;

  // ---------------------------------------------------------------------
  // Escalas de interação
  // ---------------------------------------------------------------------

  /// Compressão no toque.
  static const double pressScale = 0.92;

  /// Pico ao soltar, antes de assentar em 1.0.
  static const double releaseOvershoot = 1.05;

  /// Pico do ícone ao ser selecionado.
  static const double activeScale = 1.12;

  /// Escala inicial do botão central na entrada.
  static const double centerEnterScale = 0.75;

  // ---------------------------------------------------------------------
  // Tempos
  //
  // Deliberadamente diferentes entre si: aplicar a mesma duração em tudo é o
  // que faz uma interface parecer mecânica.
  // ---------------------------------------------------------------------

  /// Resposta ao toque — precisa acontecer antes de a navegação terminar.
  static const Duration press = Duration(milliseconds: 130);

  /// Troca de item ativo (ícone, rótulo, indicador).
  static const Duration select = Duration(milliseconds: 240);

  /// Entrada da barra.
  static const Duration entrance = Duration(milliseconds: 520);

  /// Atraso do botão central em relação à barra — ele chega depois, e é isso
  /// que o faz parecer o elemento principal.
  static const Duration centerDelay = Duration(milliseconds: 140);

  /// Entrada do botão central.
  static const Duration centerEntrance = Duration(milliseconds: 420);

  /// Passo entre a entrada de um ícone e a do próximo.
  static const Duration itemStagger = Duration(milliseconds: 55);

  /// Aparecimento/desaparecimento do brilho.
  static const Duration glow = Duration(milliseconds: 380);

  /// Ocultar/mostrar a barra no scroll.
  static const Duration hide = Duration(milliseconds: 260);

  // ---------------------------------------------------------------------
  // Sombra
  // ---------------------------------------------------------------------

  /// Sombra ampla, suave e de opacidade baixa: separa a barra do conteúdo
  /// sem virar um bloco escuro embaixo dela.
  static List<BoxShadow> shadows(Color scrim) => [
    BoxShadow(
      color: scrim.withValues(alpha: 0.34),
      blurRadius: 28,
      offset: const Offset(0, 10),
    ),
    BoxShadow(
      color: scrim.withValues(alpha: 0.18),
      blurRadius: 6,
      offset: const Offset(0, 2),
    ),
  ];
}
