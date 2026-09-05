import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/utils/app_progress_indicator.dart';
import 'package:mobile/theme/theme_extensions.dart';

class WeeklyEvents extends StatefulWidget {
  final EventModel evento;
  const WeeklyEvents({super.key, required this.evento});

  @override
  State<WeeklyEvents> createState() => _WeeklyEventsState();
}

class _WeeklyEventsState extends State<WeeklyEvents> {
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        setState(() {
          Navigator.pushNamed(
            context,
            AppRoutes.eventDetail,
            arguments: widget.evento,
          );
        });
      },
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 17.0),
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: context.colors.brasa, width: 1.3),
            borderRadius: BorderRadius.circular(30),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(29),
            child: Container(
              color: context.colors.navy,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Imagem
                  SizedBox(
                    height: widget.evento.titulo.length < 40 ? 180 : 160,
                    width: double.infinity,
                    child: CachedNetworkImage(
                      imageUrl: widget.evento.imageUrl,
                      fit: BoxFit.cover,
                      fadeInDuration: Duration.zero,
                      fadeOutDuration: Duration.zero,
                      placeholder: (_, _) =>
                          const Center(child: AppProgressIndicator()),
                      errorWidget: (_, _, _) => const Icon(Icons.error),
                    ),
                  ),

                  // Textos
                  Padding(
                    padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Text(
                          widget.evento.titulo,
                          style: GoogleFonts.inter(
                            color: context.colors.textPrimary,
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                          ),
                          textAlign: TextAlign.center,
                        ),
                        const SizedBox(height: 4),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(
                              Icons.calendar_month,
                              color: context.colors.ambar,
                              size: 22,
                            ),
                            const SizedBox(width: 6),
                            Text(
                              DateFormat("EEE dd MMM  HH:mm", "pt_BR")
                                  .format(widget.evento.dataDoEvento)
                                  .toUpperCase(),
                              style: GoogleFonts.inter(
                                color: context.colors.textMuted,
                                fontSize: 13,
                                fontWeight: FontWeight.bold,
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
          ),
        ),
      ),
    );
  }
}
