import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/highlights/close_to_you_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/location_satate.dart';

class CloseToYou extends StatefulWidget {
  const CloseToYou({super.key});

  @override
  State<CloseToYou> createState() => _CloseToYouState();
}

class _CloseToYouState extends State<CloseToYou> {
  final CloseToYouService _closeToYouService = CloseToYouService();

  List<PlaceModel> _places = [];
  bool _isLoading = true;
  String? _erro;

  @override
  void initState() {
    super.initState();
    _buscarEstabelecimentosProximos();
  }

  Future<void> _buscarEstabelecimentosProximos() async {
    setState(() {
      _isLoading = true;
      _erro = null;
    });

    if (latitudeAtual == null || longitudeAtual == null) {
      if (!mounted) return;
      setState(() {
        _erro =
            'Não foi possível acessar sua localização. Verifique se o GPS '
            'está ativado e se o app tem permissão.';
        _isLoading = false;
      });
      return;
    }

    try {
      final places = await _closeToYouService.getEstablishmentsNearby(
        latitude: latitudeAtual!,
        longitude: longitudeAtual!,
      );
      if (!mounted) return;
      setState(() {
        _places = places;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _erro = 'Não foi possível carregar os estabelecimentos próximos.';
      });
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: CircularProgressIndicator(color: context.colors.ambar),
        ),
      );
    }

    if (_erro != null) {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            Icons.location_off,
            color: context.colors.textDisabled,
            size: 40,
          ),
          const SizedBox(height: 12),
          Text(
            _erro!,
            textAlign: TextAlign.center,
            style: TextStyle(color: context.colors.textDisabled, fontSize: 14),
          ),
          const SizedBox(height: 12),
          TextButton(
            onPressed: _buscarEstabelecimentosProximos,
            child: Text(
              'Tentar novamente',
              style: TextStyle(color: context.colors.ambar),
            ),
          ),
        ],
      );
    }

    if (_places.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 24),
          child: Text(
            'Nenhum estabelecimento encontrado perto de você',
            style: TextStyle(color: context.colors.textDisabled, fontSize: 14),
          ),
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _places.length,
      itemBuilder: (context, index) {
        final place = _places[index];

        return Container(
          margin: EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: context.colors.navy,
            borderRadius: BorderRadius.circular(70),
            border: Border.all(
              color: context.colors.brasa.withAlpha(60),
              width: 2,
            ),
          ),
          child: Material(
            color: Colors.transparent,
            borderRadius: BorderRadius.circular(70),
            child: InkWell(
              onTap: () {
                Navigator.pushNamed(
                  context,
                  AppRoutes.placeDetail,
                  arguments: place.id,
                );
              },
              borderRadius: BorderRadius.circular(70),
              splashColor: context.colors.ambar,
              child: Stack(
                children: [
                  Padding(
                    padding: EdgeInsets.only(
                      left: 15,
                      top: 15,
                      bottom: 15,
                      right: 90,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Container(
                          decoration: BoxDecoration(
                            shape: BoxShape.circle,
                            border: Border.all(
                              color: context.colors.darkGrey,
                              width: 1,
                            ),
                          ),
                          child: ClipOval(
                            child: SizedBox(
                              height: 50,
                              width: 50,
                              child: place.profileImage.isEmpty
                                  ? Container(
                                      color: context.colors.darkGrey,
                                      child: Icon(
                                        Icons.storefront,
                                        color: context.colors.textDisabled,
                                      ),
                                    )
                                  : CachedNetworkImage(
                                      imageUrl: place.profileImage,
                                      fit: BoxFit.cover,
                                      fadeInDuration: Duration.zero,
                                      fadeOutDuration: Duration.zero,
                                      errorWidget: (context, error, stack) {
                                        return Container(
                                          color: context.colors.darkGrey,
                                          child: Icon(
                                            Icons.storefront,
                                            color: context.colors.textDisabled,
                                          ),
                                        );
                                      },
                                    ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                place.nome,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  color: context.colors.textPrimary,
                                  fontSize: 23,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.star_border,
                                    color: context.colors.ambar,
                                    size: 20,
                                  ),
                                  SizedBox(width: 3),
                                  Text(
                                    '${place.avaliacao}',
                                    style: TextStyle(
                                      color: context.colors.textMuted,
                                      fontSize: 15,
                                    ),
                                  ),
                                  SizedBox(width: 8),
                                  Icon(
                                    Icons.circle,
                                    color: context.colors.textDisabled,
                                    size: 8,
                                  ),
                                  SizedBox(width: 8),
                                  Text(
                                    '${place.distancia?.toStringAsFixed(0) ?? "?"}m',
                                    style: TextStyle(
                                      color: context.colors.textMuted,
                                      fontSize: 15,
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

                  Positioned(
                    top: 0,
                    bottom: 0,
                    right: 25,
                    child: Center(
                      child: Container(
                        decoration: BoxDecoration(
                          color: context.colors.ambar,
                          borderRadius: BorderRadius.circular(50),
                        ),
                        padding: EdgeInsets.symmetric(
                          horizontal: 20,
                          vertical: 4,
                        ),
                        child: Text(
                          "Ir",
                          style: TextStyle(
                            color: Colors.white,
                            fontSize: 15,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}
