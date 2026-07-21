import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/utils/app_progress_indicator.dart';
import 'package:mobile/theme/theme_extensions.dart';

class FeaturedEvents extends StatefulWidget {
  final EventModel event;

  const FeaturedEvents({super.key, required this.event});

  @override
  State<FeaturedEvents> createState() => _FeaturedEventsState();
}

class _FeaturedEventsState extends State<FeaturedEvents> {
  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () {
        setState(() {
          Navigator.pushNamed(
            context,
            AppRoutes.eventDetail,
            arguments: widget.event,
          );
        });
      },
      child: Card(
        margin: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(50)),
        clipBehavior: Clip.antiAlias,
        child: SizedBox(
          child: Stack(
            fit: StackFit.expand,
            children: [
              CachedNetworkImage(
                imageUrl: widget.event.imageUrl,
                fit: BoxFit.cover,
                fadeInDuration: Duration.zero,
                fadeOutDuration: Duration.zero,
                placeholder: (_, _) =>
                    const Center(child: AppProgressIndicator()),
                errorWidget: (_, _, _) => const Icon(Icons.error),
              ),

              DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [Colors.transparent, Colors.black.withAlpha(220)],
                  ),
                ),
              ),

              //Campos de texto sob a imagem (Estudar melhor essa parta, ta meio confuso algumas partes)
              Positioned(
                bottom: 19,
                left: 16,
                right: 16,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 8,
                        vertical: 5,
                      ),

                      decoration: BoxDecoration(
                        color: context.colors.ambar,
                        borderRadius: BorderRadius.circular(30),
                      ),

                      child: Text(
                        widget.event.categoria,
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          letterSpacing: 4,

                          shadows: [
                            Shadow(color: context.colors.brasa, blurRadius: 5),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 5),

                    Text(
                      widget.event.titulo.toUpperCase(),
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 22,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 4),
                    Text(
                      widget.event.localizacao,
                      style: TextStyle(
                        color: Colors.white.withOpacity(0.6),
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    SizedBox(height: 2),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
