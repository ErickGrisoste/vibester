import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/utils/hero_tags.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_tag.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/indicators/movement_indicator.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

enum PlaceTileVariant {
  /// Cartão vertical para trilho horizontal ("perto de você").
  rail,

  /// Linha de lista vertical, com foto quadrada à esquerda.
  row,
}

/// Card de estabelecimento.
///
/// Substitui o card anterior, que tinha 32px de padding em volta, um halo
/// âmbar embaixo da foto e o nome disputando espaço com quatro indicadores
/// empilhados. Aqui a hierarquia é explícita: **foto → nome → movimento →
/// resto**. Movimento sobe de posição porque é a informação que o produto tem
/// e ninguém mais tem — é o motivo de abrir o Vibester em vez do mapa.
///
/// Distância só aparece quando a API a devolveu (depende de permissão de
/// localização); nada de "perto de você" sem dado por trás.
class PlaceTile extends StatelessWidget {
  final PlaceModel place;
  final PlaceTileVariant variant;
  final double? width;
  final VoidCallback? onTap;
  final bool hero;

  const PlaceTile({
    super.key,
    required this.place,
    this.variant = PlaceTileVariant.row,
    this.width,
    this.onTap,
    this.hero = true,
  });

  static const _corner = BorderRadius.only(
    topLeft: Radius.circular(AppRadius.md),
    topRight: Radius.circular(AppRadius.md),
    bottomRight: Radius.circular(AppRadius.md),
  );

  void _open(BuildContext context) {
    if (onTap != null) {
      onTap!();
      return;
    }
    if (place.id == null) return;
    Navigator.pushNamed(context, AppRoutes.placeDetail, arguments: place.id);
  }

  /// A API entrega duas fotos e nem sempre as duas: banner para composição
  /// grande, perfil para miniatura, cada uma com o outro como reserva.
  String get _railImage =>
      place.bannerImage.isNotEmpty ? place.bannerImage : place.profileImage;

  String get _rowImage =>
      place.profileImage.isNotEmpty ? place.profileImage : place.bannerImage;

  @override
  Widget build(BuildContext context) {
    return VibesterPressable(
      onTap: () => _open(context),
      pressScale: AppMotion.scalePress,
      borderRadius: _corner,
      child: switch (variant) {
        PlaceTileVariant.rail => _buildRail(context),
        PlaceTileVariant.row => _buildRow(context),
      },
    );
  }

  Widget _buildRail(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final distance = formatDistance(place.distancia);

    return SizedBox(
      width: width ?? 190,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          ClipRRect(
            borderRadius: _corner,
            child: AspectRatio(
              aspectRatio: 1,
              child: Stack(
                fit: StackFit.expand,
                children: [
                  VibesterImage(
                    source: _railImage,
                    placeholderIcon: Icons.storefront_outlined,
                  ),
                  const Grain(opacity: 0.05, density: 0.4),
                  DecoratedBox(
                    decoration: BoxDecoration(gradient: colors.photoScrim),
                  ),
                  if (distance.isNotEmpty)
                    Positioned(
                      top: AppSpacing.sm,
                      left: AppSpacing.sm,
                      child: VibesterTag(
                        distance,
                        icon: Icons.near_me_outlined,
                      ),
                    ),
                  Positioned(
                    left: AppSpacing.sm + 2,
                    right: AppSpacing.sm,
                    bottom: AppSpacing.sm + 2,
                    child: MovimentoIndicator(
                      nivel: place.nivelMovimento,
                      compact: true,
                    ),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Text(
            place.nome,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: type.headlineSmall.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: 3),
          Text(
            [
              if (place.categoria.isNotEmpty) place.categoria.toUpperCase(),
              if (place.avaliacao > 0)
                '★ ${place.avaliacao.toStringAsFixed(1).replaceAll('.', ',')}',
            ].join('  ·  '),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: type.monoSmall.copyWith(color: colors.textMuted),
          ),
        ],
      ),
    );
  }

  Widget _buildRow(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final distance = formatDistance(place.distancia);

    final thumb = ClipRRect(
      borderRadius: const BorderRadius.only(
        topLeft: Radius.circular(AppRadius.sm),
        topRight: Radius.circular(AppRadius.sm),
        bottomRight: Radius.circular(AppRadius.sm),
      ),
      child: SizedBox(
        width: 72,
        height: 72,
        child: VibesterImage(
          source: _rowImage,
          placeholderIcon: Icons.storefront_outlined,
        ),
      ),
    );

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          hero ? Hero(tag: placeImageHeroTag(place), child: thumb) : thumb,
          const SizedBox(width: AppSpacing.lg),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        place.nome,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: type.headlineSmall.copyWith(
                          color: colors.textPrimary,
                        ),
                      ),
                    ),
                    if (distance.isNotEmpty) ...[
                      const SizedBox(width: AppSpacing.sm),
                      Text(
                        distance,
                        style: type.monoSmall.copyWith(color: colors.textMuted),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: AppSpacing.xs + 2),
                MovimentoIndicator(nivel: place.nivelMovimento),
                const SizedBox(height: AppSpacing.sm),
                Text(
                  [
                    if (place.categoria.isNotEmpty)
                      place.categoria.toUpperCase(),
                    if (place.avaliacao > 0)
                      '★ ${place.avaliacao.toStringAsFixed(1).replaceAll('.', ',')} (${place.qtdAvaliacoes})',
                    if (place.nivelPrecoMedio.isNotEmpty)
                      _priceGlyph(place.nivelPrecoMedio),
                  ].join('  ·  '),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: type.monoSmall.copyWith(color: colors.textDisabled),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// `priceIndicator` vem da API como 'baixo'/'medio'/'alto'.
  static String _priceGlyph(String nivel) => switch (nivel.toLowerCase()) {
    'baixo' => r'$',
    'medio' || 'médio' => r'$$',
    'alto' => r'$$$',
    _ => '',
  };
}
