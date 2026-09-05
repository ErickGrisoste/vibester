// ignore_for_file: prefer_final_fields

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/theme/theme_extensions.dart';

class PrimaryButton extends StatefulWidget {
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
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton> {
  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(seconds: 2),
      curve: Curves.easeOutBack,
      width: 350,
      height: 60,
      decoration: BoxDecoration(
        color: widget.state.color(context),
        borderRadius: BorderRadius.circular(30),
        boxShadow: [
          BoxShadow(
            color: context.colors.ambar.withOpacity(0.5),
            blurRadius: 12,
            spreadRadius: 1,
          ),
          BoxShadow(
            color: context.colors.ambar.withOpacity(0.3),
            blurRadius: 20,
            spreadRadius: 1,
          ),
          BoxShadow(
            color: context.colors.ambar.withOpacity(0.15),
            blurRadius: 30,
            spreadRadius: 1,
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(30),
        child: InkWell(
          borderRadius: BorderRadius.circular(30),
          onTap: widget.onPressed,
          child: Center(
            child: widget.state == ButtonState.idle
                ? Text(
                    widget.label,
                    style: GoogleFonts.inter(
                      fontWeight: FontWeight.bold,
                      color: context.colors.textPrimary,
                    ),
                  )
                : Text(
                    widget.state.label,
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
    ButtonState.idle => context.colors.ambar,
    ButtonState.loading => const Color(0xFFFFAA00),
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
