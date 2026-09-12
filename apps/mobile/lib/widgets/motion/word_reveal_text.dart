import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Headline entrando palavra por palavra (seção 28 do briefing de motion
/// 2.0) — reservado para momentos de alto impacto (onboarding), não para
/// texto comum.
class WordRevealText extends StatelessWidget {
  final String text;
  final TextStyle? style;

  const WordRevealText({super.key, required this.text, this.style});

  @override
  Widget build(BuildContext context) {
    final words = text.split(' ');
    return Wrap(
      children: [
        for (final (i, word) in words.indexed)
          TweenAnimationBuilder<double>(
            tween: Tween(begin: 0.0, end: 1.0),
            duration: context.adaptiveMotion(AppMotion.expressive),
            curve: Curves.easeOutCubic,
            builder: (context, t, child) {
              final delayed = ((t - i * 0.08) / (1 - i * 0.08)).clamp(0.0, 1.0);
              return Opacity(
                opacity: delayed,
                child: Transform.translate(
                  offset: Offset(0, (1 - delayed) * AppMotion.distanceMedium),
                  child: child,
                ),
              );
            },
            child: Text('$word ', style: style),
          ),
      ],
    );
  }
}
