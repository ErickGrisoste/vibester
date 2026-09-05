import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/user/interest_model.dart';
import 'package:mobile/theme/theme_extensions.dart';

class CategoryHighlightsSection extends StatefulWidget {
  const CategoryHighlightsSection({super.key});

  @override
  State<CategoryHighlightsSection> createState() =>
      _CategoryHighlightsSectionState();
}

class _CategoryHighlightsSectionState extends State<CategoryHighlightsSection> {
  final List<Interest> _interests = defaultInterests;

  @override
  Widget build(BuildContext context) {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      physics: const BouncingScrollPhysics(),
      child: Row(
        children: _interests.map((interest) {
          return Padding(
            padding: const EdgeInsets.only(right: 10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              decoration: BoxDecoration(
                color: context.colors.ambar,
                borderRadius: BorderRadius.circular(30),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(interest.emoji, style: const TextStyle(fontSize: 18)),
                  const SizedBox(width: 6),
                  Text(
                    interest.label,
                    style: GoogleFonts.inter(
                      color: context.colors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}
