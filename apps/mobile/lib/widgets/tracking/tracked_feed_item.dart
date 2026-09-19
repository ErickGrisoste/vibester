import 'package:flutter/material.dart';
import 'package:mobile/service/interaction/interaction_tracker.dart';
import 'package:provider/provider.dart';
import 'package:visibility_detector/visibility_detector.dart';

/// Envolve um item de lista e reporta ao [InteractionTracker] quanto tempo ele
/// ficou na tela.
///
/// É só o sensor: toda a régua de "o que conta como visto" mora no tracker.
class TrackedFeedItem extends StatefulWidget {
  const TrackedFeedItem({
    super.key,
    required this.item,
    required this.child,
  });

  final TrackedItem item;
  final Widget child;

  @override
  State<TrackedFeedItem> createState() => _TrackedFeedItemState();
}

class _TrackedFeedItemState extends State<TrackedFeedItem> {
  /// Guardado aqui porque `context.read` não pode ser chamado no `dispose`, que
  /// é justamente onde o episódio precisa ser fechado.
  InteractionTracker? _tracker;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _tracker = context.read<InteractionTracker>();
  }

  @override
  void dispose() {
    // O card pode sumir da árvore sem nunca reportar fração 0 — lista
    // recarregada no pull-to-refresh, tela desmontada. Sem fechar aqui, a
    // impressão desse item nunca sairia.
    _tracker?.onItemDetached(widget.item.itemId);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return VisibilityDetector(
      // A chave identifica o detector globalmente e precisa ser única e estável
      // entre rebuilds; o prefixo evita colisão com qualquer outra superfície
      // rastreada que mostre o mesmo item.
      key: Key('tracked-${widget.item.source.wire}-${widget.item.itemId}'),
      onVisibilityChanged: (info) {
        if (!mounted) return;

        _tracker?.onVisibilityChanged(widget.item, info.visibleFraction);
      },
      child: widget.child,
    );
  }
}
