import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/theme/theme_extensions.dart';

class TertiaryButton extends StatefulWidget {
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
  State<TertiaryButton> createState() => _TertiaryButtonState();
}

class _TertiaryButtonState extends State<TertiaryButton> {
  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(seconds: 3),
      curve: Curves.easeOutBack,
      width: double.infinity,
      height: 60,
      decoration: BoxDecoration(
        color: widget.state.color(context),
        borderRadius: BorderRadius.circular(30),
        border: widget.state == ButtonState.idle
            ? Border.all(width: 1, color: context.colors.ambar)
            : null,
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(30),
        child: InkWell(
          borderRadius: BorderRadius.circular(30),
          onTap: widget.onPressed,
          child: Center(
            child: Text(
              widget.state.label.toUpperCase(),
              style: GoogleFonts.inter(
                fontWeight: FontWeight.bold,
                color: context.colors.textPrimary,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

enum ButtonState {
  idle,
  loading,
  success,
  error;

  Color color(BuildContext context) => switch (this) {
    ButtonState.idle => context.colors.navy,
    ButtonState.loading => const Color(0xFFFFAA00),
    ButtonState.success => context.colors.ambar,
    ButtonState.error => context.colors.error,
  };

  String get label => switch (this) {
    ButtonState.idle => 'Vou ir',
    ButtonState.loading => 'Carregando...',
    ButtonState.success => 'Interessado',
    ButtonState.error => 'Erro',
  };
}
