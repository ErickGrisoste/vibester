import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';

/// O movimento de uma página do onboarding, em dois eixos:
///
/// - **[intro]** — a entrada da página, de 0 a 1, tocada uma vez quando ela
///   aparece. É dela que sai o escalonamento (título → texto → cards).
/// - **[delta]** — onde a página está em relação à tela, lido direto do
///   `PageController`: 0 = centrada, 1 = já saiu pela esquerda, -1 = ainda à
///   direita. É o que deixa o swipe *conduzir* a animação em vez de só
///   disparar a próxima: cada camada anda numa velocidade proporcional a ele.
///
/// Um objeto só, passado a todos os visuais, para as camadas de uma página
/// nunca discordarem sobre em que ponto do gesto ela está.
class SlideMotion {
  SlideMotion({
    required this.intro,
    required this.pages,
    required this.index,
    required this.reduceMotion,
  }) : listenable = Listenable.merge([intro, pages]);

  final Animation<double> intro;
  final PageController pages;
  final int index;

  /// Sistema pediu menos movimento: some o parallax, fica a navegação.
  final bool reduceMotion;

  /// Dispara a cada frame de entrada ou de swipe — é o que os
  /// `AnimatedBuilder` dos visuais escutam.
  final Listenable listenable;

  double get delta {
    if (!pages.hasClients || !pages.position.haveDimensions) return 0;
    return (pages.page ?? index.toDouble()) - index;
  }

  /// [delta] para deslocamento de profundidade — zero com movimento reduzido.
  double get parallax => reduceMotion ? 0 : delta.clamp(-1.0, 1.0);

  /// Progresso da entrada do item [i] de uma sequência, com a curva aplicada.
  ///
  /// [start] é quando o primeiro item começa (fração de [intro]), [step] o
  /// atraso entre itens e [span] quanto cada um leva. Com [AppMotion.emphasis]
  /// o valor passa de 1 no meio do caminho — é o overshoot leve dos cards;
  /// quem usa o valor como opacidade precisa limitar a 0..1.
  double stagger(
    double start, {
    int i = 0,
    double step = 0.1,
    double span = 0.45,
    Curve curve = AppMotion.enter,
  }) {
    final begin = (start + i * step).clamp(0.0, 0.95);
    final end = (begin + span).clamp(begin + 0.05, 1.0);
    return curve.transform(Interval(begin, end).transform(intro.value));
  }
}

/// Um laço lento e contínuo (0 → 1 → 0) para o que flutua no fundo.
///
/// Cada visual que usa monta o seu, então o laço morre junto com a página
/// quando o `PageView` a descarta — nada fica tocando fora da tela. Dentro de
/// uma rota coberta, o `TickerMode` do `Navigator` já silencia o ticker.
/// Com movimento reduzido o laço nem começa.
class AmbientLoop extends StatefulWidget {
  final Widget Function(BuildContext context, Animation<double> ambient)
  builder;

  const AmbientLoop({super.key, required this.builder});

  @override
  State<AmbientLoop> createState() => _AmbientLoopState();
}

class _AmbientLoopState extends State<AmbientLoop>
    with SingleTickerProviderStateMixin {
  late final AnimationController _loop = AnimationController(
    vsync: this,
    duration: const Duration(seconds: 7),
  );

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (AppMotion.reduceMotion(context)) {
      _loop.stop();
    } else if (!_loop.isAnimating) {
      _loop.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _loop.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context, _loop);
}

/// Oscilação suave de um elemento no laço ambiente, defasada por [phase]
/// para os elementos não subirem e descerem juntos.
double ambientWave(Animation<double> ambient, double phase) =>
    math.sin((ambient.value + phase) * 2 * math.pi);

/// Deslocamento horizontal de uma camada ao arrastar a página: [factor] da
/// largura, no sentido do gesto. Positivo segura a camada (fundo), negativo
/// adianta (frente).
Offset parallaxOffset(SlideMotion motion, double width, double factor) =>
    Offset(motion.parallax * width * factor, 0);

/// Tempo de uma página entrar inteira — a faixa "expressiva" do
/// `AppMotion`, esticada porque aqui entram vários elementos em sequência.
const onboardingIntroDuration = Duration(milliseconds: 1100);
