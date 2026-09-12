import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/divider.dart';
import 'package:mobile/widgets/indicators/like_indicator.dart';

class PublicationCard extends StatelessWidget {
  final PublicationModel publication;

  const PublicationCard({super.key, required this.publication});

  String _timeAgo(DateTime date) {
    final diff = DateTime.now().difference(date);

    if (diff.inSeconds < 60) return 'agora mesmo';
    if (diff.inMinutes < 60) return 'há ${diff.inMinutes} min';
    if (diff.inHours < 24) return 'há ${diff.inHours}h';
    if (diff.inDays < 7) return 'há ${diff.inDays}d';
    if (diff.inDays < 30) return 'há ${(diff.inDays / 7).floor()} sem';
    if (diff.inDays < 365) return 'há ${(diff.inDays / 30).floor()} meses';
    return 'há ${(diff.inDays / 365).floor()} anos';
  }

  Widget _buildImage(String src) {
    if (src.startsWith('http')) {
      return CachedNetworkImage(
        imageUrl: src,
        fit: BoxFit.cover,
        fadeInDuration: Duration.zero,
        fadeOutDuration: Duration.zero,
        placeholder: (_, _) => const Center(child: CircularProgressIndicator()),
        errorWidget: (_, _, _) => const Icon(Icons.error),
      );
    }
    return Image.file(File(src), fit: BoxFit.cover);
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: EdgeInsets.symmetric(horizontal: 10.0, vertical: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.center,
              children: [
                InkWell(
                  onTap: publication.authorId != null
                      ? () => Navigator.pushNamed(
                          context,
                          AppRoutes.otherProfile,
                          arguments: publication.authorId,
                        )
                      : null,
                  child: CircleAvatar(
                    radius: 27,
                    backgroundImage: CachedNetworkImageProvider(
                      publication.autorProfileImage,
                    ),
                  ),
                ),
                SizedBox(width: 10),
                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              publication.autor,
                              style: GoogleFonts.inter(
                                color: context.colors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                            Text(
                              _timeAgo(publication.publicatedAt),
                              style: GoogleFonts.inter(
                                color: context.colors.textMuted,
                                fontSize: 11,
                              ),
                            ),
                            if (publication.location != null)
                              Row(
                                mainAxisAlignment: MainAxisAlignment.end,
                                children: [
                                  Icon(
                                    Icons.location_on_outlined,
                                    color: context.colors.brasa,
                                    size: 16,
                                  ),
                                  SizedBox(width: 3),
                                  Text(
                                    publication.location!,
                                    style: GoogleFonts.inter(
                                      color: context.colors.brasa.withAlpha(
                                        150,
                                      ),
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          Container(
            color: Colors.grey.withAlpha(50),
            child: AspectRatio(
              aspectRatio: 4 / 5,
              child: _buildImage(publication.publicationImage),
            ),
          ),

          Padding(
            padding: EdgeInsets.symmetric(horizontal: 10.0, vertical: 10),
            child: Text.rich(
              TextSpan(
                text: '${publication.autor}: ',
                style: GoogleFonts.inter(
                  color: context.colors.textPrimary,
                  fontWeight: FontWeight.bold,
                ),
                children: [
                  TextSpan(
                    text: publication.description,
                    style: GoogleFonts.inter(color: context.colors.textMuted),
                  ),
                ],
              ),
            ),
          ),

          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [LikeIndicator(publication: publication)],
          ),

          MyDivider(height: 1, width: double.infinity),
        ],
      ),
    );
  }
}
