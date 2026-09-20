import 'package:flutter/widgets.dart';

/// Observador global de rotas, registrado no `MaterialApp`.
///
/// Existe para a telemetria do feed saber que uma rota foi empilhada por cima.
/// Quando isso acontece o `Overlay` para de pintar a rota de baixo, e o
/// `VisibilityDetector` dos cards congela no último valor reportado — sem este
/// aviso, o post que estava na tela continuaria acumulando atenção enquanto o
/// usuário navega em outra tela.
final RouteObserver<ModalRoute<void>> appRouteObserver =
    RouteObserver<ModalRoute<void>>();
