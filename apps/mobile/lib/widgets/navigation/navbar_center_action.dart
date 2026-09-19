import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/navigation/navbar_tokens.dart';

/// Ação central da navbar — publicar.
///
/// É a única ação da navegação que não leva a um lugar: leva a *fazer* algo.
/// Por isso ganha um tratamento à parte dentro da fileira — círculo em cor de
/// marca, maior que os ícones vizinhos, com luz própria e a animação mais
/// expressiva da barra. Fica **dentro** da barra, não apoiado sobre ela: é um
/// elemento da navegação, não um objeto colado por cima.
///
/// Motion, em três camadas:
///
/// * **entrada** — chega depois da barra (`centerDelay`) e cresce de 0.75
///   passando de 1.0 antes de assentar, com o brilho subindo junto. É o
///   atraso que a faz parecer o elemento principal em vez de mais um item.
/// * **toque** — comprime com mola e o ícone gira 45°, transformando o "+"
///   num "x": a mesma forma que fecha o composer que ele abre, então o gesto
///   já anuncia o destino.
/// * **soltar** — volta com overshoot curto e a luz pulsa uma vez.
///
/// Sem rotação contínua, sem partícula, sem pulso infinito: o botão só se
/// mexe quando alguém o toca.
class NavbarCenterAction extends StatefulWidget {
  final VoidCallback onTap;

  /// Progresso de entrada (0 a 1), orquestrado pela navbar.
  final double entrance;

  final String semanticLabel;

  const NavbarCenterAction({
    super.key,
    required this.onTap,
    this.entrance = 1,
    this.semanticLabel = 'Publicar',
  });

  @override
  State<NavbarCenterAction> createState() => _NavbarCenterActionState();
}

class _NavbarCenterActionState extends State<NavbarCenterAction>
    with SingleTickerProviderStateMixin {
  late final AnimationController _press = AnimationController(
    vsync: this,
    value: 1,
    lowerBound: 0.82,
    upperBound: 1.14,
  );

  bool _pressed = false;

  @override
  void dispose() {
    _press.dispose();
    super.dispose();
  }

  void _animate(bool pressed) {
    setState(() => _pressed = pressed);

    if (context.reduceMotion) {
      _press.value = 1;
      return;
    }

    _press.animateWith(
      SpringSimulation(
        pressed ? AppMotion.springPress : AppMotion.springBouncy,
        _press.value,
        pressed ? NavbarTokens.pressScale : 1.0,
        pressed ? 0 : 3.2,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    // Entrada: 0.75 → passa de 1 → assenta. easeOutBack dá o overshoot sem
    // precisar de uma sequência de tweens só para isso.
    final entrada = Curves.easeOutBack.transform(
      widget.entrance.clamp(0.0, 1.0),
    );
    final escalaEntrada =
        NavbarTokens.centerEnterScale +
        (1 - NavbarTokens.centerEnterScale) * entrada;

    return Semantics(
      button: true,
      label: widget.semanticLabel,
      child: GestureDetector(
        onTap: widget.onTap,
        onTapDown: (_) => _animate(true),
        onTapUp: (_) => _animate(false),
        onTapCancel: () => _animate(false),
        behavior: HitTestBehavior.opaque,
        child: AnimatedBuilder(
          animation: _press,
          builder: (context, child) => Transform.scale(
            scale: _press.value * escalaEntrada,
            child: child,
          ),
          child: SizedBox(
            width: NavbarTokens.centerSize,
            height: NavbarTokens.centerSize,
            child: Stack(
              alignment: Alignment.center,
              clipBehavior: Clip.none,
              children: [
                // Luz própria: intensifica no toque. Fica atrás do círculo,
                // então parece a superfície acesa, não um contorno brilhante.
                AnimatedContainer(
                  duration: context.adaptiveMotion(NavbarTokens.glow),
                  curve: AppMotion.standard,
                  width: NavbarTokens.centerSize,
                  height: NavbarTokens.centerSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: colors.ambar.withValues(
                          alpha:
                              (_pressed ? 0.5 : NavbarTokens.glowOpacity) *
                              widget.entrance,
                        ),
                        blurRadius: _pressed ? 22 : 16,
                        spreadRadius: _pressed ? 2 : 0,
                      ),
                      BoxShadow(
                        color: colors.brasa.withValues(
                          alpha: 0.22 * widget.entrance,
                        ),
                        blurRadius: 24,
                        offset: const Offset(0, 6),
                      ),
                    ],
                  ),
                ),

                Container(
                  width: NavbarTokens.centerSize,
                  height: NavbarTokens.centerSize,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    // Gradiente da marca, não cor chapada: dá volume ao
                    // círculo sem precisar de sombra interna.
                    gradient: LinearGradient(
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                      colors: [colors.ambar, colors.brasa],
                    ),
                    // Anel fino apenas para destacar o círculo do vidro por
                    // baixo. A borda grossa de antes existia para separá-lo da
                    // barra quando ele transbordava a borda — dentro dela, só
                    // engrossaria o desenho.
                    border: Border.all(
                      color: colors.scrim.withValues(alpha: 0.28),
                      width: 1,
                    ),
                  ),
                  child: AnimatedRotation(
                    // "+" vira "x" a caminho do composer.
                    turns: _pressed ? 0.125 : 0,
                    duration: context.adaptiveMotion(NavbarTokens.select),
                    curve: AppMotion.emphasis,
                    child: Icon(
                      Icons.add_rounded,
                      size: 26,
                      // onFill escolhe tinta ou branco pelo contraste real —
                      // branco sobre âmbar daria 2,47:1.
                      color: colors.onAmbar,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
