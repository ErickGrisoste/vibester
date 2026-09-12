import 'package:flutter/material.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/models/media/post_media.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/relative_time.dart';
import 'package:mobile/utils/username.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_tag.dart';
import 'package:mobile/widgets/indicators/like_indicator.dart';
import 'package:mobile/widgets/media/post_media_carousel.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Publicação no feed.
///
/// O feed é a parte do produto com maior risco de virar cópia de outra rede:
/// a estrutura avatar → foto → curtida é praticamente universal. A saída aqui
/// não foi inventar uma estrutura estranha (o usuário sabe ler feed, e mexer
/// nisso custaria usabilidade por nada), e sim mudar a **matéria**: a foto é
/// tratada como um retrato colado no muro — levemente torta, com sombra dura
/// de papel e grão por cima — e não como uma placa de vidro dentro de um
/// cartão branco.
///
/// A inclinação é minúscula (menos de 1°) e determinística pelo índice do
/// item: alterna de lado a cada post, então a coluna ganha ritmo sem parecer
/// bagunça, e o mesmo post nunca "muda de posição" ao rolar de volta.
///
/// O selo de local não é enfeite: quando o post veio de um estabelecimento,
/// ele é o atalho para a página dele — é o que costura a rede social à
/// descoberta, que é a razão de o Vibester ter as duas coisas.
class PublicationCard extends StatelessWidget {
  final PublicationModel publication;

  /// Posição na lista, usada para a inclinação alternada.
  final int index;

  const PublicationCard({super.key, required this.publication, this.index = 0});

  double get _tilt => (index.isEven ? 1 : -1) * 0.0055;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.md,
        AppSpacing.screen,
        AppSpacing.xxl,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _AuthorLine(publication: publication),
          const SizedBox(height: AppSpacing.md),

          Transform.rotate(
            angle: _tilt,
            child: Container(
              decoration: BoxDecoration(
                boxShadow: [
                  // Sombra dura, sem desfoque: papel sobre parede.
                  BoxShadow(
                    color: colors.scrim.withValues(alpha: 0.5),
                    offset: const Offset(5, 5),
                  ),
                ],
              ),
              child: ClipRRect(
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(AppRadius.sm),
                  topRight: Radius.circular(AppRadius.sm),
                  bottomRight: Radius.circular(AppRadius.sm),
                ),
                child: AspectRatio(
                  aspectRatio: 4 / 5,
                  child: Stack(
                    fit: StackFit.expand,
                    children: [
                      // Foto, vídeo ou carrossel — na ordem de `media`. O
                      // indicador vai no topo porque a base é do selo de local.
                      PostMediaCarousel(
                        media: publication.media.isNotEmpty
                            ? publication.media
                            : [
                                if (publication.publicationImage.isNotEmpty)
                                  PostMedia.image(publication.publicationImage),
                              ],
                        grain: true,
                        indicatorOnTop: true,
                      ),
                      if (publication.location != null &&
                          publication.location!.isNotEmpty)
                        Positioned(
                          left: AppSpacing.md,
                          bottom: AppSpacing.md,
                          child: VibesterTag(
                            publication.location!,
                            icon: Icons.place_outlined,
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: AppSpacing.md),

          if (publication.description.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Text(
                publication.description,
                style: type.bodyLarge.copyWith(color: colors.textSecondary),
              ),
            ),

          Row(
            children: [
              LikeIndicator(publication: publication),
              const Spacer(),
              Text(
                formatRelativeTime(publication.publicatedAt).toUpperCase(),
                style: type.monoMicro.copyWith(color: colors.textDisabled),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

/// Linha de autoria: avatar, @, e o local como destino tocável.
class _AuthorLine extends StatelessWidget {
  final PublicationModel publication;

  const _AuthorLine({required this.publication});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Row(
      children: [
        VibesterPressable(
          borderRadius: AppRadius.pillAll,
          onTap: publication.authorId == null
              ? null
              : () => Navigator.pushNamed(
                  context,
                  AppRoutes.otherProfile,
                  arguments: publication.authorId,
                ),
          child: Row(
            children: [
              ClipOval(
                child: SizedBox(
                  width: 36,
                  height: 36,
                  child: VibesterImage(
                    source: publication.autorProfileImage,
                    placeholderIcon: Icons.person_outline_rounded,
                  ),
                ),
              ),
              const SizedBox(width: AppSpacing.md),
              Text(
                publication.autor.isEmpty
                    ? 'Alguém'
                    : formatHandle(publication.autor),
                style: type.titleSmall.copyWith(color: colors.textPrimary),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
