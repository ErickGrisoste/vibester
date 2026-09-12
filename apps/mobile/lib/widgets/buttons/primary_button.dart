import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';

/// Ação principal de uma tela.
///
/// Hoje é uma fachada fina sobre [VibesterButton] — a implementação real (as
/// quatro variantes, os quatro estados, o alvo de 56px) vive lá. Este arquivo
/// existe porque `PrimaryButton` aparece em oito telas com a mesma assinatura;
/// em tela nova, use [VibesterButton] direto.
class PrimaryButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final ButtonState state;

  const PrimaryButton({
    super.key,
    required this.label,
    required this.onPressed,
    this.state = ButtonState.idle,
  });

  @override
  Widget build(BuildContext context) {
    return VibesterButton(
      label: state == ButtonState.idle ? label : state.label,
      onPressed: onPressed,
      state: state.toButtonState(),
      successLabel: state.label,
      errorLabel: state.label,
    );
  }
}

/// Estado das ações de seguir/salvar. Mantido para compatibilidade com as
/// telas existentes; internamente mapeia para [VibesterButtonState].
enum ButtonState {
  idle,
  loading,
  success,
  error;

  VibesterButtonState toButtonState() => switch (this) {
    ButtonState.idle => VibesterButtonState.idle,
    ButtonState.loading => VibesterButtonState.loading,
    ButtonState.success => VibesterButtonState.success,
    ButtonState.error => VibesterButtonState.error,
  };

  Color color(BuildContext context) => switch (this) {
    ButtonState.idle => context.colors.ambar,
    ButtonState.loading => context.colors.ambar,
    ButtonState.success => context.colors.navy,
    ButtonState.error => context.colors.error,
  };

  String get label => switch (this) {
    ButtonState.idle => 'Seguir',
    ButtonState.loading => 'Carregando...',
    ButtonState.success => 'Seguindo',
    ButtonState.error => 'Erro',
  };
}
