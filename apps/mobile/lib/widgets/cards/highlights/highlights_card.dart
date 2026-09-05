import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';

class HighlightsCard extends StatelessWidget {
  final HighlightModel highlight;

  const HighlightsCard({super.key, required this.highlight});

  @override
  Widget build(BuildContext context) {
    final imageUrl = highlight.imagemEmDestaque;

    return Material(
      color: Colors.transparent,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {
          Navigator.pushNamed(
            context,
            AppRoutes.postDetail,
            arguments: highlight,
          );
        },
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: context.colors.ambar, width: 1),
            borderRadius: BorderRadius.circular(12),
          ),
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: imageUrl.isEmpty
                ? Container(
                    color: Colors.white12,
                    child: Icon(
                      Icons.image_not_supported_outlined,
                      color: context.colors.textDisabled,
                    ),
                  )
                : CachedNetworkImage(
                    imageUrl: imageUrl,
                    fit: BoxFit.cover,
                    // Miniatura de grid (2 colunas): decodificar em resolução
                    // menor evita que a imagem em tela cheia do post detail
                    // expulse essas miniaturas do cache de memória.
                    memCacheWidth: 400,
                    fadeInDuration: Duration.zero,
                    fadeOutDuration: Duration.zero,
                    progressIndicatorBuilder: (context, url, progress) {
                      return Container(
                        color: Colors.white12,
                        child: Center(
                          child: CircularProgressIndicator(
                            color: context.colors.ambar,
                            strokeWidth: 2,
                            value: progress.progress,
                          ),
                        ),
                      );
                    },
                    errorWidget: (context, url, error) {
                      debugPrint('Erro ao carregar imagem ($imageUrl): $error');
                      return Container(
                        color: Colors.white12,
                        child: Icon(
                          Icons.broken_image_outlined,
                          color: context.colors.textDisabled,
                        ),
                      );
                    },
                  ),
          ),
        ),
      ),
    );
  }
}
