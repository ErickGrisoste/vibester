import 'package:diacritic/diacritic.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_search_field.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:provider/provider.dart';

/// Folha de seleção de local para uma publicação.
///
/// Devolve o [PlaceModel] inteiro, não só o nome. Isso não é detalhe de
/// implementação: o `createPost` aceita `establishmentId`, `establishmentName`,
/// `establishmentLogo` e `establishmentCategory`, e a versão anterior devolvia
/// apenas a string do nome — que a tela guardava numa variável e **nunca
/// enviava**. Na prática, marcar um lugar não marcava nada. Com o modelo
/// completo, o post nasce ligado ao estabelecimento e o selo de local no feed
/// passa a valer.
class LocationPicker extends StatefulWidget {
  const LocationPicker({super.key});

  @override
  State<LocationPicker> createState() => _LocationPickerState();
}

class _LocationPickerState extends State<LocationPicker> {
  final _controller = TextEditingController();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PlaceListProvider>().fetchPlaces();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final query = removeDiacritics(_query.trim().toLowerCase());

    final places = context
        .watch<PlaceListProvider>()
        .places
        .where(
          (p) =>
              query.isEmpty ||
              removeDiacritics(p.nome.toLowerCase()).contains(query) ||
              removeDiacritics(p.categoria.toLowerCase()).contains(query),
        )
        .toList();

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screen,
                AppSpacing.sm,
                AppSpacing.screen,
                AppSpacing.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'ONDE FOI?',
                    style: context.typography.monoEyebrow.copyWith(
                      color: colors.ambar,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  VibesterSearchField(
                    controller: _controller,
                    hint: 'Procurar lugar',
                    onChanged: (value) => setState(() => _query = value),
                  ),
                ],
              ),
            ),
            Flexible(
              child: places.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.all(AppSpacing.xxl),
                      child: Center(
                        child: Text(
                          'NENHUM LUGAR ENCONTRADO',
                          style: context.typography.monoSmall.copyWith(
                            color: colors.textDisabled,
                          ),
                        ),
                      ),
                    )
                  : ListView.builder(
                      shrinkWrap: true,
                      padding: const EdgeInsets.only(bottom: AppSpacing.lg),
                      itemCount: places.length,
                      itemBuilder: (context, index) {
                        final place = places[index];
                        return VibesterPressable(
                          onTap: () => Navigator.pop(context, place),
                          child: Padding(
                            padding: const EdgeInsets.symmetric(
                              horizontal: AppSpacing.screen,
                              vertical: AppSpacing.sm,
                            ),
                            child: Row(
                              children: [
                                ClipRRect(
                                  borderRadius: AppRadius.smAll,
                                  child: SizedBox(
                                    width: 44,
                                    height: 44,
                                    child: VibesterImage(
                                      source: place.profileImage,
                                      placeholderIcon:
                                          Icons.storefront_outlined,
                                    ),
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.md),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        place.nome,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: context.typography.titleMedium
                                            .copyWith(
                                              color: colors.textPrimary,
                                            ),
                                      ),
                                      if (place.categoria.isNotEmpty)
                                        Text(
                                          place.categoria.toUpperCase(),
                                          style: context.typography.monoMicro
                                              .copyWith(
                                                color: colors.textMuted,
                                              ),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
