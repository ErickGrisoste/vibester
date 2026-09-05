import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class CaptionTextField extends StatefulWidget {
  final TextEditingController controller;
  final int maxLength;

  const CaptionTextField({
    super.key,
    required this.controller,
    this.maxLength = 200,
  });

  @override
  State<CaptionTextField> createState() => _CaptionTextFieldState();
}

class _CaptionTextFieldState extends State<CaptionTextField> {
  final FocusNode _focusNode = FocusNode();

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_refresh);
    _focusNode.addListener(_refresh);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_refresh);
    _focusNode.removeListener(_refresh);
    _focusNode.dispose();
    super.dispose();
  }

  void _refresh() => setState(() {});

  @override
  Widget build(BuildContext context) {
    final currentLength = widget.controller.text.length;
    final remaining = widget.maxLength - currentLength;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Legenda',
          style: TextStyle(
            color: context.colors.textSecondary,
            fontSize: 13,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 8),

        TextFormField(
          textInputAction: TextInputAction.done,
          controller: widget.controller,
          focusNode: _focusNode,
          maxLength: widget.maxLength,
          maxLines: 5,
          cursorColor: context.colors.textMuted,
          minLines: 4,
          style: TextStyle(
            color: context.colors.textPrimary,
            fontSize: 14,
            height: 1.5,
          ),
          decoration: InputDecoration(
            hintText: 'Compartilhe sua experiência...',
            hintStyle: TextStyle(color: context.colors.textDisabled),
            counterText: '',
            contentPadding: const EdgeInsets.all(16),
            filled: true,
            fillColor: context.colors.noturno,
            errorStyle: TextStyle(color: context.colors.error, fontSize: 12),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(18),
              borderSide: BorderSide(color: context.colors.border, width: 1.3),
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
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return 'Adicione uma legenda!';
            }
            return null;
          },
        ),

        const SizedBox(height: 8),

        Align(
          alignment: Alignment.centerRight,
          child: AnimatedDefaultTextStyle(
            duration: const Duration(milliseconds: 200),
            style: TextStyle(
              color: remaining == 0
                  ? context.colors.error
                  : remaining <= 20
                  ? Colors.orangeAccent
                  : context.colors.textDisabled,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
            child: Text('$remaining caracteres restantes'),
          ),
        ),
      ],
    );
  }
}
