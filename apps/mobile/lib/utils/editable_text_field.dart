import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class EditableTextField extends StatelessWidget {
  final String label;
  final double height;
  final double? width;
  final EdgeInsets padding;

  const EditableTextField({
    super.key,
    required this.label,
    required this.height,
    this.width,
    this.padding = const EdgeInsets.symmetric(horizontal: 6),
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: const BoxConstraints(minWidth: 150, maxWidth: 280),
      height: height,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.all(Radius.circular(50)),
        color: context.colors.noturno,
        border: Border.all(color: context.colors.brasa, width: 1),
      ),
      child: Center(
        child: Text(
          label.toUpperCase(),
          style: TextStyle(
            color: context.colors.brasa,
            fontWeight: FontWeight.bold,
          ),
          overflow: TextOverflow.ellipsis,
          maxLines: 1,
        ),
      ),
    );
  }
}
