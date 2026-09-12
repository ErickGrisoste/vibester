import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Substituto de `showDialog` com o "pop" pedido na seção 21 do briefing de
/// motion 2.0: scale 0.90 → 1.03 → 1 + fade, em vez do dialog "simplesmente
/// aparecendo". Centraliza a transição num único lugar (seção 24) em vez de
/// repetir `transitionBuilder` em cada tela que abre um diálogo.
Future<T?> showVibesterDialog<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool barrierDismissible = true,
}) {
  final duration = context.adaptiveMotion(AppMotion.ui);
  return showGeneralDialog<T>(
    context: context,
    barrierDismissible: barrierDismissible,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    barrierColor: Colors.black54,
    transitionDuration: duration,
    pageBuilder: (context, _, _) => Builder(builder: builder),
    transitionBuilder: (context, animation, _, child) {
      if (duration == Duration.zero) return child;

      final curved = CurvedAnimation(parent: animation, curve: Curves.linear);
      return FadeTransition(
        opacity: CurvedAnimation(parent: animation, curve: AppMotion.enter),
        child: ScaleTransition(scale: _popTween.animate(curved), child: child),
      );
    },
  );
}

final _popTween = TweenSequence<double>([
  TweenSequenceItem(
    tween: Tween(
      begin: 0.90,
      end: 1.03,
    ).chain(CurveTween(curve: Curves.easeOut)),
    weight: 70,
  ),
  TweenSequenceItem(
    tween: Tween(
      begin: 1.03,
      end: 1.0,
    ).chain(CurveTween(curve: Curves.easeOut)),
    weight: 30,
  ),
]);
