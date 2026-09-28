import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_category_covers.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/place/place_tile.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/onboarding/onboarding_motion.dart';
import 'package:provider/provider.dart';

/// Página 3 — os lugares.
///
/// Duas faixas, as duas do produto real: em cima as categorias do Explorar
/// (as mesmas capas de `placeCategoryCovers`), embaixo um trilho de
/// `PlaceTile` com os estabelecimentos que a API devolveu. O trilho entra
/// rápido da direita, como quem passa o dedo num catálogo — a variedade é
/// mostrada, não listada.
///
/// Sem estabelecimento com foto, as próprias categorias ocupam o visual em
/// duas fileiras grandes: a página continua falando de variedade de lugar
/// sem inventar nenhum.
class PlacesVisual extends StatelessWidget {
  final SlideMotion motion;

  const PlacesVisual({super.key, required this.motion});

  static const _maxPlaces = 6;

  static List<PlaceModel> _pick(List<PlaceModel> places) => places
      .where((p) => p.profileImage.isNotEmpty || p.bannerImage.isNotEmpty)
      .take(_maxPlaces)
      .toList();

  @override
  Widget build(BuildContext context) {
    final places = context.select<PlaceListProvider, List<PlaceModel>>(
      (p) => _pick(p.places),
    );

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final height = constraints.maxHeight;

        final List<_Row> rows;
        if (places.isNotEmpty) {
          // Categorias numa faixa fina em cima (se houver altura), lugares
          // no trilho principal. O `PlaceTile.rail` é foto 1:1 + ~52pt de
          // nome e categoria.
          final strip = height >= 230 ? (height * 0.24).clamp(52.0, 76.0) : 0.0;
          final gap = strip > 0 ? AppSpacing.lg : 0.0;
          final tile = (height - strip - gap - 52).clamp(56.0, 176.0);

          rows = [
            if (strip > 0)
              _Row(
                items: [
                  for (final (label, image) in placeCategoryCovers)
                    _CategoryCover(label: label, image: image, size: strip),
                ],
                height: strip,
                spacing: AppSpacing.sm,
                start: 0.3,
                enterFrom: const Offset(0, AppMotion.distanceMedium),
                curve: AppMotion.emphasis,
                parallax: -0.12,
              ),
            _Row(
              items: [
                for (final place in places)
                  IgnorePointer(
                    child: PlaceTile(
                      place: place,
                      variant: PlaceTileVariant.rail,
                      width: tile,
                      hero: false,
                    ),
                  ),
              ],
              height: tile + 52,
              spacing: AppSpacing.md,
              start: 0.08,
              enterFrom: Offset(width * 0.6, 0),
              parallax: -0.28,
            ),
          ];
        } else {
          // Sem lugar: as seis categorias em duas fileiras desencontradas,
          // cada uma num ritmo — ainda é "olha quanta coisa", sem nome
          // inventado.
          final cover = ((height - AppSpacing.md) / 2).clamp(56.0, 150.0);
          final half = placeCategoryCovers.length ~/ 2;

          _Row coverRow(Iterable<(String, String)> covers, int n) => _Row(
            items: [
              for (final (label, image) in covers)
                _CategoryCover(label: label, image: image, size: cover),
            ],
            height: cover,
            spacing: AppSpacing.md,
            indent: n * cover * 0.4,
            start: 0.08 + n * 0.1,
            enterFrom: Offset(width * 0.6, 0),
            parallax: n == 0 ? -0.28 : -0.16,
          );

          rows = [
            coverRow(placeCategoryCovers.take(half), 0),
            coverRow(placeCategoryCovers.skip(half), 1),
          ];
        }

        return AnimatedBuilder(
          animation: motion.listenable,
          // Em aparelho muito baixo as fileiras podem passar alguns pontos
          // do espaço; o `OverflowBox` deixa vazar em vez de acusar estouro.
          // `minHeight: 0` porque a altura vinda do `Expanded` é justa, e
          // herdada como mínimo ela esticaria a coluna e colaria as fileiras
          // no topo em vez de centralizá-las.
          builder: (context, _) => OverflowBox(
            minHeight: 0,
            maxHeight: double.infinity,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final (i, row) in rows.indexed) ...[
                  if (i > 0) const SizedBox(height: AppSpacing.md),
                  SizedBox(height: row.height, child: _track(row, width)),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  /// Uma faixa horizontal que vaza pela direita — a borda cortada é o que
  /// diz "tem mais". [parallax] negativo adianta a faixa em relação à página
  /// no swipe: o trilho parece continuar andando depois que o dedo solta.
  Widget _track(_Row row, double width) {
    return Transform.translate(
      offset: parallaxOffset(motion, width, row.parallax),
      child: SizedBox(
        width: width,
        // Largura livre: a fileira vaza pela direita.
        child: OverflowBox(
          alignment: Alignment.centerLeft,
          maxWidth: double.infinity,
          maxHeight: double.infinity,
          child: Padding(
            padding: EdgeInsets.only(left: AppSpacing.screen + row.indent),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final (i, item) in row.items.indexed) ...[
                  if (i > 0) SizedBox(width: row.spacing),
                  Builder(
                    builder: (_) {
                      final entry = motion.stagger(
                        row.start,
                        i: i,
                        step: 0.06,
                        span: 0.42,
                        curve: row.curve,
                      );
                      return Opacity(
                        opacity: entry.clamp(0.0, 1.0),
                        child: Transform.translate(
                          offset: row.enterFrom * (1 - entry),
                          child: item,
                        ),
                      );
                    },
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Uma fileira horizontal do visual: o que entra nela e como se move.
class _Row {
  final List<Widget> items;
  final double height;
  final double spacing;

  /// Recuo extra à esquerda — desencontra uma fileira da outra.
  final double indent;

  /// Início da entrada, em fração da intro da página.
  final double start;
  final Offset enterFrom;
  final Curve curve;
  final double parallax;

  const _Row({
    required this.items,
    required this.height,
    required this.spacing,
    required this.start,
    required this.enterFrom,
    required this.parallax,
    this.indent = 0,
    this.curve = AppMotion.enter,
  });
}

/// Capa de categoria — a mesma imagem e o mesmo rótulo do Explorar, em
/// miniatura. Rótulo branco sobre o scrim da foto, como lá.
class _CategoryCover extends StatelessWidget {
  final String label;
  final String image;
  final double size;

  const _CategoryCover({
    required this.label,
    required this.image,
    required this.size,
  });

  @override
  Widget build(BuildContext context) {
    final type = context.typography;
    final big = size > 100;

    return ClipRRect(
      borderRadius: const BorderRadius.only(
        topLeft: Radius.circular(AppRadius.md),
        topRight: Radius.circular(AppRadius.md),
        bottomRight: Radius.circular(AppRadius.md),
      ),
      child: SizedBox.square(
        dimension: size,
        child: Stack(
          fit: StackFit.expand,
          children: [
            VibesterImage(source: image),
            DecoratedBox(
              decoration: BoxDecoration(gradient: context.colors.photoScrim),
            ),
            Padding(
              padding: EdgeInsets.all(big ? AppSpacing.md : AppSpacing.xs + 2),
              child: Align(
                alignment: Alignment.bottomLeft,
                child: Text(
                  label.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: (big ? type.headlineSmall : type.monoMicro).copyWith(
                    color: Colors.white,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
