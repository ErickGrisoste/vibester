import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class PrimaryTextField extends StatelessWidget {
  final String labelText;
  final double height;
  final TextInputAction textInputAction;

  const PrimaryTextField({
    super.key,
    required this.labelText,
    required this.height,
    this.textInputAction = TextInputAction.done,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 350,
      height: height,
      child: TextFormField(
        textInputAction: textInputAction,
        expands: true,
        maxLines: null,
        minLines: null,
        style: TextStyle(color: Colors.white),
        cursorColor: context.colors.ambar,
        decoration: InputDecoration(
          labelText: labelText,
          labelStyle: TextStyle(color: Colors.white54),
          filled: true,
          fillColor: Color(0xFF141414),
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(20)),
          errorStyle: TextStyle(color: context.colors.error, fontSize: 12),
          enabledBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: const BorderSide(color: Colors.white10, width: 1.3),
          ),
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(color: context.colors.ambar, width: 1.3),
          ),
          errorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(color: context.colors.error, width: 1.3),
          ),
          focusedErrorBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(18),
            borderSide: BorderSide(color: context.colors.error, width: 1.3),
          ),
        ),
        keyboardType: TextInputType.emailAddress,
        validator: (value) {
          if (value == null || value.isEmpty) {
            return 'Campo obrigatório!';
          }
          return null;
        },
      ),
    );
  }
}
