import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/external_links.dart';

/// Trecho clicável dentro de um `Text.rich` (termos, privacidade).
///
/// Usa `WidgetSpan` com `GestureDetector` em vez de `TapGestureRecognizer`:
/// o recognizer precisaria de `dispose` num `State`, e estas frases vivem em
/// telas `StatelessWidget`.
class LegalLink {
  LegalLink._();

  static InlineSpan span(
    BuildContext context, {
    required String label,
    required Uri uri,
    required TextStyle style,
  }) {
    final colors = context.colors;

    return WidgetSpan(
      alignment: PlaceholderAlignment.baseline,
      baseline: TextBaseline.alphabetic,
      child: Semantics(
        link: true,
        label: label,
        excludeSemantics: true,
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () => ExternalLinks.open(context, uri),
          child: Text(
            label,
            style: style.copyWith(
              color: colors.ambar,
              fontWeight: FontWeight.w700,
              decoration: TextDecoration.underline,
              decorationColor: colors.ambar,
            ),
          ),
        ),
      ),
    );
  }
}
