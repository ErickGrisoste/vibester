import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/navigation/navbar_background.dart';
import 'package:mobile/widgets/navigation/navbar_center_action.dart';
import 'package:mobile/widgets/navigation/navbar_indicator.dart';
import 'package:mobile/widgets/navigation/navbar_item.dart';
import 'package:mobile/widgets/navigation/navbar_tokens.dart';

export 'package:mobile/widgets/navigation/navbar_item.dart'
    show NavbarDestination;

/// Navegação principal do Vibester.
///
/// Um objeto de vidro apoiado sobre o app: pill flutuante, luz difusa por
/// trás, destaque que viaja entre os destinos e uma ação central luminosa no
/// meio da fileira. Não é uma `BottomNavigationBar` com efeitos — é uma
/// superfície própria, e a intenção é que ela continue reconhecível como
/// Vibester mesmo recortada do resto da tela.
///
/// **Estado.** O componente não decide nada de navegação: recebe
/// [currentIndex] e devolve [onDestinationSelected]. A fonte da verdade
/// continua sendo a casca (`HomeScreen`), e nenhuma rota, provider ou service
/// foi tocado para isto existir.
///
/// **Layout.** Tudo cabe dentro da altura da barra, inclusive a ação central:
/// ela ocupa um vão no meio da fileira em vez de ficar apoiada sobre a borda.
/// Além de ser o que o produto pediu, isso elimina de vez a possibilidade de
/// uma parte do botão ficar visível fora do pai e parar de receber toque —
/// o defeito silencioso mais comum do padrão sobreposto.
///
/// **Orquestração de entrada.** Um controller só conduz tudo, com a barra
/// chegando primeiro, os ícones escalonados e a ação central por último:
///
/// ```text
/// barra    ▁▁▁▂▄▆█            sobe 20px + fade
/// ícones      ▁▂▄▆█           escalonados, 55ms entre eles
/// luz          ▁▂▄▆█          sobe junto
/// ação            ▁▄█▇█       0.75 → passa de 1 → assenta
/// ```
class VibesterNavbar extends StatefulWidget {
  final List<NavbarDestination> destinations;
  final int currentIndex;
  final ValueChanged<int> onDestinationSelected;

  /// Ação central. Nulo remove o botão e a concavidade.
  final VoidCallback? onCreate;

  /// Índice que exibe o selo de não lidas.
  final int? badgeIndex;
  final int badgeCount;

  /// Falso desliza a barra para fora da tela (usado no scroll). A animação de
  /// saída vive aqui dentro para que quem usa a navbar só precise informar
  /// uma intenção, não coreografar deslocamento e opacidade.
  final bool visible;

  const VibesterNavbar({
    super.key,
    required this.destinations,
    required this.currentIndex,
    required this.onDestinationSelected,
    this.onCreate,
    this.badgeIndex,
    this.badgeCount = 0,
    this.visible = true,
  });

  @override
  State<VibesterNavbar> createState() => _VibesterNavbarState();
}

class _VibesterNavbarState extends State<VibesterNavbar>
    with TickerProviderStateMixin {
  /// Posição contínua do indicador. Os limites passam do intervalo real de
  /// índices porque a mola ultrapassa o alvo antes de assentar; sem essa
  /// folga o overshoot seria cortado e o movimento pareceria travar no fim.
  late final AnimationController _indicator = AnimationController(
    vsync: this,
    value: widget.currentIndex.toDouble(),
    lowerBound: -0.4,
    upperBound: widget.destinations.length - 1 + 0.4,
  );

  late final AnimationController _entrance = AnimationController(
    vsync: this,
    duration: NavbarTokens.entrance,
  );

  @override
  void initState() {
    super.initState();

    // Um frame depois: a navbar entra sobre a primeira tela já desenhada.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      if (context.reduceMotion) {
        _entrance.value = 1;
      } else {
        _entrance.forward();
      }
    });
  }

  @override
  void didUpdateWidget(covariant VibesterNavbar old) {
    super.didUpdateWidget(old);
    if (widget.currentIndex == old.currentIndex) return;

    final alvo = widget.currentIndex.toDouble();
    if (context.reduceMotion) {
      _indicator.value = alvo;
    } else {
      _indicator.animateWith(
        SpringSimulation(AppMotion.springSmooth, _indicator.value, alvo, 0),
      );
    }
  }

  @override
  void dispose() {
    _indicator.dispose();
    _entrance.dispose();
    super.dispose();
  }

  /// Progresso de entrada de uma faixa da orquestração, normalizado em 0–1.
  double _tramo(double inicio, double fim) {
    final t = (_entrance.value - inicio) / (fim - inicio);
    return t.clamp(0.0, 1.0);
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).padding.bottom;
    final temAcaoCentral = widget.onCreate != null;
    final meio = widget.destinations.length ~/ 2;

    return AnimatedSlide(
      offset: widget.visible ? Offset.zero : const Offset(0, 1.4),
      duration: context.adaptiveMotion(NavbarTokens.hide),
      curve: AppMotion.standard,
      child: AnimatedOpacity(
        opacity: widget.visible ? 1 : 0,
        duration: context.adaptiveMotion(NavbarTokens.hide),
        curve: AppMotion.standard,
        child: IgnorePointer(
          ignoring: !widget.visible,
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              NavbarTokens.horizontalMargin,
              0,
              NavbarTokens.horizontalMargin,
              // Com gesture bar, encosta logo acima dela; sem ela, mantém
              // folga própria — em nenhum dos casos cola na borda física.
              bottomInset > 0 ? bottomInset - 4 : NavbarTokens.bottomMargin,
            ),
            child: RepaintBoundary(
              child: AnimatedBuilder(
                animation: _entrance,
                builder: (context, child) {
                  final barra = _tramo(0, 0.55);
                  return Opacity(
                    opacity: barra,
                    child: Transform.translate(
                      offset: Offset(0, (1 - barra) * 20),
                      child: child,
                    ),
                  );
                },
                child: AnimatedBuilder(
                  animation: _entrance,
                  builder: (context, _) => NavbarBackground(
                    glow: _tramo(0.3, 1.0),
                    child: _buildRow(context, temAcaoCentral, meio),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildRow(BuildContext context, bool temAcaoCentral, int meio) {
    return LayoutBuilder(
      builder: (context, constraints) {
        // O vão do botão central sai da largura disponível; os destinos
        // dividem o resto igualmente. Nada de posição absoluta em pixel: a
        // geometria vem sempre do espaço que a tela deu.
        final vao = temAcaoCentral ? NavbarTokens.centerSlot : 0.0;
        const inset = NavbarTokens.contentInset;
        final slot =
            (constraints.maxWidth - vao - inset * 2) /
            widget.destinations.length;

        return Stack(
          children: [
            AnimatedBuilder(
              animation: Listenable.merge([_indicator, _entrance]),
              builder: (context, _) => NavbarIndicator(
                position: _indicator.value,
                slotWidth: slot,
                centerGap: vao,
                leadingInset: inset,
                middleIndex: meio,
                intensity: _tramo(0.35, 1.0),
              ),
            ),

            AnimatedBuilder(
              animation: _entrance,
              builder: (context, _) => Row(
                children: [
                  const SizedBox(width: inset),
                  for (var i = 0; i < widget.destinations.length; i++) ...[
                    // A ação central ocupa o vão no meio da fileira — é um
                    // item da barra, não um objeto sobreposto a ela.
                    if (temAcaoCentral && i == meio)
                      SizedBox(
                        width: vao,
                        child: Center(
                          child: NavbarCenterAction(
                            onTap: widget.onCreate!,
                            entrance: _tramo(0.35, 1.0),
                          ),
                        ),
                      ),
                    NavbarItem(
                      destination: widget.destinations[i],
                      active: i == widget.currentIndex,
                      width: slot,
                      badgeCount: widget.badgeIndex == i
                          ? widget.badgeCount
                          : 0,
                      entrance: _tramo(0.25 + i * 0.08, 0.65 + i * 0.08),
                      onTap: () => widget.onDestinationSelected(i),
                    ),
                  ],
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
