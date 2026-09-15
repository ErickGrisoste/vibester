import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/external_links.dart';
import 'package:mobile/widgets/common/legal_link.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Aceite explícito dos Termos de Uso e da Política de Privacidade no
/// cadastro. É um `FormField`: o formulário não valida sem a caixa marcada.
class TermsConsentField extends FormField<bool> {
  TermsConsentField({super.key})
    : super(
        initialValue: false,
        validator: (value) => value == true
            ? null
            : 'Para criar a conta, aceite os Termos e a Política',
        builder: (field) => _TermsConsentView(
          accepted: field.value ?? false,
          errorText: field.errorText,
          onChanged: field.didChange,
        ),
      );
}

class _TermsConsentView extends StatelessWidget {
  final bool accepted;
  final String? errorText;
  final ValueChanged<bool> onChanged;

  const _TermsConsentView({
    required this.accepted,
    required this.errorText,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final hasError = errorText != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Semantics(
              checked: accepted,
              label: 'Aceito os Termos de Uso e a Política de Privacidade',
              excludeSemantics: true,
              child: VibesterPressable(
                onTap: () => onChanged(!accepted),
                borderRadius: AppRadius.smAll,
                child: SizedBox(
                  width: 44,
                  height: 44,
                  child: Icon(
                    accepted
                        ? Icons.check_box_rounded
                        : Icons.check_box_outline_blank_rounded,
                    color: accepted
                        ? colors.ambar
                        : hasError
                        ? colors.error
                        : colors.textMuted,
                  ),
                ),
              ),
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: AppSpacing.md),
                child: Text.rich(
                  TextSpan(
                    style: type.bodyMedium.copyWith(color: colors.textMuted),
                    children: [
                      const TextSpan(text: 'Tenho 18 anos ou mais e aceito os '),
                      LegalLink.span(
                        context,
                        label: 'Termos de Uso',
                        uri: ExternalLinks.terms,
                        style: type.bodyMedium,
                      ),
                      const TextSpan(text: ' e a '),
                      LegalLink.span(
                        context,
                        label: 'Política de Privacidade',
                        uri: ExternalLinks.privacy,
                        style: type.bodyMedium,
                      ),
                      const TextSpan(
                        text: '. Conteúdo abusivo não é tolerado.',
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(left: 44),
            child: Text(
              errorText!,
              style: type.bodySmall.copyWith(color: colors.error),
            ),
          ),
      ],
    );
  }
}
