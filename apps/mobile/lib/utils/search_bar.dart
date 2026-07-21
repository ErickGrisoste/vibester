import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class CustomSearchBar extends StatelessWidget {
  final TextEditingController controller;
  final VoidCallback onChanged;
  final VoidCallback? onSubmitted;

  const CustomSearchBar({
    super.key,
    required this.controller,
    required this.onChanged,
    this.onSubmitted,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: context.colors.noturno,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white.withOpacity(0.12), width: 2),
      ),
      child: TextField(
        controller: controller,
        cursorColor: context.colors.ambar,
        style: const TextStyle(color: Colors.white),
        onChanged: (_) => onChanged(),
        onSubmitted: (_) => onSubmitted?.call(),
        decoration: InputDecoration(
          hintText: 'Buscar por nome ou categoria...',
          hintStyle: TextStyle(color: Colors.white38, fontSize: 14),
          prefixIcon: Icon(Icons.search, color: context.colors.ambar),
          suffixIcon: controller.text.isNotEmpty
              ? IconButton(
                  icon: Icon(Icons.close, color: Colors.white38),
                  onPressed: () {
                    controller.clear();
                    onChanged();
                  },
                )
              : null,
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 16,
            vertical: 14,
          ),
        ),
      ),
    );
  }
}
