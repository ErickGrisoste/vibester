import 'package:flutter/material.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Célula da grade de publicações (perfil e estabelecimento).
///
/// Perde a moldura âmbar de 1px que envolvia cada foto — numa grade de duas
/// colunas, doze contornos coloridos competem com as próprias fotos. Fica só a
/// imagem, com o mesmo canto rasgado dos demais cartões do app e um grão leve
/// para amarrar a grade à textura do produto.
class HighlightsCard extends StatelessWidget {
  final HighlightModel highlight;

  const HighlightsCard({super.key, required this.highlight});

  @override
  Widget build(BuildContext context) {
    return VibesterPressable(
      pressScale: AppMotion.scalePress,
      borderRadius: AppRadius.smAll,
      onTap: () => Navigator.pushNamed(
        context,
        AppRoutes.postDetail,
        arguments: highlight,
      ),
      child: ClipRRect(
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(AppRadius.sm),
          topRight: Radius.circular(AppRadius.sm),
          bottomRight: Radius.circular(AppRadius.sm),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            VibesterImage(
              source: highlight.imagemEmDestaque,
              placeholderIcon: Icons.photo_outlined,
            ),
            const Grain(opacity: 0.05, density: 0.3),
            // Na grade só a capa aparece: o selo avisa que há vídeo ou mais
            // itens do que se vê.
            if (highlight.temVideo || highlight.midias.length > 1)
              Positioned(
                right: AppSpacing.sm,
                top: AppSpacing.sm,
                child: Icon(
                  highlight.temVideo
                      ? Icons.play_circle_fill_rounded
                      : Icons.collections_rounded,
                  size: 18,
                  color: context.colors.onFill(context.colors.scrim),
                  shadows: [
                    Shadow(
                      color: context.colors.scrim.withValues(alpha: 0.6),
                      blurRadius: 4,
                    ),
                  ],
                  semanticLabel: highlight.temVideo
                      ? 'Tem vídeo'
                      : '${highlight.midias.length} itens',
                ),
              ),
          ],
        ),
      ),
    );
  }
}
