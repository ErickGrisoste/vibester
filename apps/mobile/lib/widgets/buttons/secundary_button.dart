import 'package:flutter/material.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';

/// Ação secundária com ícone (ex.: "Comprar ingresso" no detalhe do evento).
/// Fachada fina sobre [VibesterButton] — em tela nova, use ele direto.
class SecundaryButton extends StatelessWidget {
  final String label;
  final VoidCallback onPressed;
  final IconData? icon;

  const SecundaryButton({
    super.key,
    this.icon,
    required this.label,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return VibesterButton(
      label: label,
      onPressed: onPressed,
      icon: icon,
      variant: VibesterButtonVariant.outline,
    );
  }
}
