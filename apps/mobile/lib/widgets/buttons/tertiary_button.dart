import 'package:flutter/material.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';

/// Confirmação de presença em evento ("Vou ir" → "Confirmado"). Fachada fina
/// sobre [VibesterButton]; a variante `accent` (brasa) marca que é a ação
/// que conecta o usuário ao rolê, não uma ação de formulário.
class TertiaryButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final ButtonState state;

  const TertiaryButton({
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
      icon: Icons.bolt_rounded,
      successLabel: state.label,
      errorLabel: state.label,
      variant: VibesterButtonVariant.accent,
    );
  }
}

/// Estados do botão de presença. Mantido aqui por compatibilidade com
/// `event_detail_screen`; mapeia para [VibesterButtonState].
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

  String get label => switch (this) {
    ButtonState.idle => 'Vou ir',
    ButtonState.loading => 'Confirmando...',
    ButtonState.success => 'Confirmado',
    ButtonState.error => 'Erro',
  };
}
