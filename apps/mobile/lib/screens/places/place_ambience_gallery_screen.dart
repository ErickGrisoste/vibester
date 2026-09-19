import 'package:flutter/material.dart';
import 'package:mobile/service/places/place_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Galeria em tela cheia com as fotos do ambiente do estabelecimento —
/// fachada, decoração, pista, área externa.
///
/// É uma tela própria (aberta a partir de um botão no cabeçalho do detalhe),
/// não uma aba: o ambiente é curadoria do próprio local, sem curtida,
/// comentário ou autor, e por isso não compete por espaço com ROLANDO
/// (`PropertyHighlightsScreen`, que mostra publicações de usuários).
///
/// Os dados vêm de [PlaceService.getAmbiencePhotos], hoje mock — ver o
/// comentário lá para o plano de troca pelo endpoint real.
class PlaceAmbienceGalleryScreen extends StatefulWidget {
  final String placeId;
  final String placeName;

  const PlaceAmbienceGalleryScreen({
    super.key,
    required this.placeId,
    required this.placeName,
  });

  @override
  State<PlaceAmbienceGalleryScreen> createState() =>
      _PlaceAmbienceGalleryScreenState();
}

class _PlaceAmbienceGalleryScreenState
    extends State<PlaceAmbienceGalleryScreen> {
  final PlaceService _placeService = PlaceService();
  late Future<List<String>> _photosFuture = _placeService.getAmbiencePhotos(
    widget.placeId,
  );
  final PageController _pageController = PageController();
  int _current = 0;

  void _reload() {
    setState(() {
      _photosFuture = _placeService.getAmbiencePhotos(widget.placeId);
      _current = 0;
    });
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned.fill(
              child: FutureBuilder<List<String>>(
                future: _photosFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return const VibesterSkeleton(
                      borderRadius: BorderRadius.zero,
                    );
                  }

                  if (snapshot.hasError) {
                    return VibesterState.error(
                      message:
                          'Não foi possível carregar as fotos do ambiente.',
                      onAction: _reload,
                    );
                  }

                  final photos = snapshot.data!;
                  if (photos.isEmpty) {
                    return const VibesterState(
                      headline: 'Sem fotos',
                      message:
                          'Esse lugar ainda não tem fotos do ambiente. Elas '
                          'aparecem aqui assim que existirem.',
                      icon: Icons.photo_camera_back_outlined,
                    );
                  }

                  return Stack(
                    children: [
                      PageView.builder(
                        controller: _pageController,
                        itemCount: photos.length,
                        onPageChanged: (i) => setState(() => _current = i),
                        itemBuilder: (context, index) => InteractiveViewer(
                          minScale: 1,
                          maxScale: 4,
                          child: Center(
                            child: VibesterImage(
                              source: photos[index],
                              fit: BoxFit.contain,
                            ),
                          ),
                        ),
                      ),
                      if (photos.length > 1)
                        Positioned(
                          bottom: AppSpacing.lg,
                          left: 0,
                          right: 0,
                          child: Center(
                            child: Text(
                              '${_current + 1} DE ${photos.length}',
                              style: context.typography.monoMicro.copyWith(
                                color: Colors.white,
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
              ),
            ),

            // Cabeçalho sobre um degradê, pro título continuar legível em
            // cima de foto clara.
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: DecoratedBox(
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    begin: Alignment.topCenter,
                    end: Alignment.bottomCenter,
                    colors: [
                      Colors.black.withValues(alpha: 0.65),
                      Colors.transparent,
                    ],
                  ),
                ),
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.lg,
                    AppSpacing.sm,
                    AppSpacing.lg,
                    AppSpacing.xxl,
                  ),
                  child: Row(
                    children: [
                      _GalleryAction(
                        icon: Icons.arrow_back_rounded,
                        label: 'Voltar',
                        onTap: () => Navigator.maybePop(context),
                      ),
                      const SizedBox(width: AppSpacing.md),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'AMBIENTE',
                              style: context.typography.monoMicro.copyWith(
                                color: Colors.white.withValues(alpha: 0.7),
                              ),
                            ),
                            Text(
                              widget.placeName,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: context.typography.titleMedium.copyWith(
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
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

class _GalleryAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _GalleryAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: VibesterPressable(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.4),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: Icon(icon, size: 20, color: Colors.white),
        ),
      ),
    );
  }
}
