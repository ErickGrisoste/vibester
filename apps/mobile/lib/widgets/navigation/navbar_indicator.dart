import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/navigation/navbar_tokens.dart';

/// Destaque do item ativo: um halo luminoso que **viaja** entre as posições.
///
/// Não é uma barrinha nem um ponto que some de um slot e aparece no outro. O
/// halo percorre fisicamente a distância, e é isso que faz os quatro destinos
/// lerem como um sistema só em vez de quatro botões independentes — quando o
/// destaque atravessa a barra, o olho entende que existe *uma* seleção se
/// movendo.
///
/// É só a cápsula: uma superfície acesa em `ambar` que desliza por baixo do
/// item. Antes havia também um halo radial e um traço de marcador embaixo;
/// os dois saíram a pedido — o destaque agora é cor de fundo e nada mais, o
/// que também deixa a leitura mais calma numa barra que já tem vidro, grão e
/// um botão luminoso no meio.
///
/// A cápsula envolve **ícone e rótulo**, não só o ícone. Como o rótulo existe
/// apenas no destino ativo, é o conjunto inteiro que diz "você está aqui";
/// cobrir só a metade de cima deixava o texto pendurado fora do destaque,
/// como se pertencesse a outra coisa.
class NavbarIndicator extends StatelessWidget {
  /// Posição contínua entre slots. Pode ultrapassar os limites durante o
  /// overshoot da mola — o desenho lida com isso naturalmente.
  final double position;

  /// Largura de cada slot de destino.
  final double slotWidth;

  /// Vão do botão central, que empurra os destinos depois dele.
  final double centerGap;

  /// Margem interna da fileira. O halo precisa começar de onde os itens
  /// começam: sem isso, a luz do primeiro e do último destino bate na curva
  /// da pill e é cortada pelo recorte, virando um retângulo de aresta viva em
  /// vez de uma luz difusa.
  final double leadingInset;

  /// Índice a partir do qual os destinos ficam depois do vão.
  final int middleIndex;

  /// Intensidade, de 0 a 1 — animada na entrada da navbar.
  final double intensity;

  const NavbarIndicator({
    super.key,
    required this.position,
    required this.slotWidth,
    required this.centerGap,
    required this.middleIndex,
    this.leadingInset = 0,
    this.intensity = 1,
  });

  @override
  Widget build(BuildContext context) {
    if (slotWidth <= 0 || intensity <= 0) return const SizedBox.shrink();

    return IgnorePointer(
      child: CustomPaint(
        size: Size(double.infinity, NavbarTokens.height),
        painter: _IndicatorPainter(
          position: position,
          slotWidth: slotWidth,
          centerGap: centerGap,
          leadingInset: leadingInset,
          middleIndex: middleIndex,
          intensity: intensity,
          accent: context.colors.ambar,
        ),
      ),
    );
  }
}

class _IndicatorPainter extends CustomPainter {
  final double position;
  final double slotWidth;
  final double centerGap;
  final double leadingInset;
  final int middleIndex;
  final double intensity;
  final Color accent;

  const _IndicatorPainter({
    required this.position,
    required this.slotWidth,
    required this.centerGap,
    required this.leadingInset,
    required this.middleIndex,
    required this.intensity,
    required this.accent,
  });

  /// Altura da cápsula.
  ///
  /// O conteúdo do item ativo mede cerca de 36px — ícone (23) + 3 de folga +
  /// rótulo de 9px com entrelinha 1.1 — e o `Column` do item é centralizado
  /// nos [NavbarTokens.height] da barra, ocupando de 18 a 54. Uma cápsula de
  /// 48 centrada no mesmo eixo vai de 12 a 60: cobre os dois com a mesma
  /// folga em cima e embaixo, e ainda sobra margem para o rótulo crescer até
  /// o teto de text scaling de 1.3 que o item impõe.
  static const double _height = 48;

  /// Fração do slot ocupada pela cápsula.
  ///
  /// Larga o bastante para o rótulo mais comprido: "EXPLORAR" em DM Mono 9px
  /// com `letterSpacing: 1.0` mede uns 51px, e num aparelho de 390px o slot
  /// dá ~67px. Os 66% de antes davam 44px e cortariam o texto nas pontas.
  static const double _widthFactor = 0.92;

  /// Raio proporcional à altura nova. Com 16, a cápsula mais alta lia como
  /// retângulo de canto lixado em vez de cápsula.
  static const Radius _radius = Radius.circular(20);

  @override
  void paint(Canvas canvas, Size size) {
    if (slotWidth <= 0) return;

    // Destinos depois do vão central estão deslocados pela largura dele. O
    // deslocamento acompanha a travessia em vez de saltar no meio dela, senão
    // o halo "teleportaria" ao cruzar o botão central. A travessia começa
    // quando o halo sai do item anterior ao vão (middleIndex - 1) e termina
    // exatamente ao chegar no item depois do vão (middleIndex) — usar
    // "middleIndex - 0.5" como início fazia o halo assentar em cima do botão
    // central com só metade do deslocamento aplicado.
    final crossing = (position - (middleIndex - 1)).clamp(0.0, 1.0);
    final shift = centerGap * crossing;

    final left = leadingInset + position * slotWidth + shift;
    final centerX = left + slotWidth / 2;

    // Centro da barra: é onde o par ícone+rótulo está centralizado. Havia um
    // -7 aqui, de quando a cápsula envolvia só o ícone.
    final centerY = size.height / 2;

    final capsule = RRect.fromRectAndRadius(
      Rect.fromCenter(
        center: Offset(centerX, centerY),
        width: slotWidth * _widthFactor,
        height: _height,
      ),
      _radius,
    );

    canvas.drawRRect(
      capsule,
      Paint()..color = accent.withValues(alpha: 0.16 * intensity),
    );
  }

  @override
  bool shouldRepaint(_IndicatorPainter old) =>
      old.position != position ||
      old.slotWidth != slotWidth ||
      old.centerGap != centerGap ||
      old.leadingInset != leadingInset ||
      old.intensity != intensity ||
      old.accent != accent;
}