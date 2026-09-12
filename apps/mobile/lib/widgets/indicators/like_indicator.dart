import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:provider/provider.dart';

class LikeIndicator extends StatelessWidget {
  final PublicationModel publication;
  const LikeIndicator({super.key, required this.publication});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: 10.0),
      child: AnimatedScale(
        scale: publication.isLiked ? 1.3 : 1.0,
        duration: Duration(milliseconds: 1000),
        curve: Curves.elasticOut,
        child: GestureDetector(
          onTap: () {
            final userId = context.read<UserProvider>().user?.accountId;
            if (userId == null) return;
            context.read<PublicationListProvider>().toggleLike(
              publication.id,
              userId,
            );
          },
          child: Container(
            padding: EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            decoration: BoxDecoration(
              color: context.colors.noturno,
              borderRadius: BorderRadius.circular(30),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.favorite,
                  color: publication.isLiked
                      ? context.colors.brasa
                      : context.colors.textDisabled,
                ),
                SizedBox(width: 10),
                Text(
                  publication.likes.toString(),
                  style: GoogleFonts.inter(
                    fontWeight: FontWeight.bold,
                    color: publication.isLiked
                        ? context.colors.brasa
                        : context.colors.textDisabled,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
