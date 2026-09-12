import 'dart:async';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/place/exclusive_offers_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/screens/highlights/category_highlights_section.dart';
import 'package:mobile/service/location/location_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/location_satate.dart';
import 'package:mobile/widgets/cards/highlights/close_to_you.dart';
import 'package:mobile/widgets/cards/highlights/exclusive_offers.dart';
import 'package:mobile/widgets/cards/event/featured_events.dart';
import 'package:mobile/widgets/cards/event/weekly_events.dart';
import 'package:mobile/widgets/indicators/lineup_place_indicator.dart';
import 'package:provider/provider.dart';

class HighlightsSectionScreen extends StatefulWidget {
  final TabController? tabController;
  final int? tabIndex;

  const HighlightsSectionScreen({super.key, this.tabController, this.tabIndex});

  @override
  State<HighlightsSectionScreen> createState() =>
      _HighlightsSectionScreenState();
}

class _HighlightsSectionScreenState extends State<HighlightsSectionScreen> {
  late PageController _pageController;
  late PageController _offersController;
  late Timer _timer;
  late Timer _offersTimer;
  int _currentPage = 0;
  int _currentOffer = 0;

  final _locationService = LocationService();
  // Controla o icone de refresh
  bool _atualizandoLocalizacao = false;

  Future<void> _atualizarLocalizacaoManualmente() async {
    setState(() {
      _atualizandoLocalizacao = true;
      latitudeAtual = null;
      longitudeAtual = null;
    });

    try {
      final posicao = await _locationService.getCurrentPosition();
      latitudeAtual = posicao.latitude;
      longitudeAtual = posicao.longitude;
    } catch (e) {
      debugPrint('Erro ao atualizar localização manualmente: $e');
    } finally {
      if (mounted) setState(() => _atualizandoLocalizacao = false);
    }
  }

  @override
  void initState() {
    super.initState();
    _pageController = PageController(viewportFraction: 0.95);
    _offersController = PageController(viewportFraction: 0.95);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<EventsListProvider>().fetchFeaturedEvents();
      context.read<EventsListProvider>().fetchWeekEvents();
      context.read<PlaceListProvider>().fetchPlaces();
    });

    // Escuta a troca de aba e refaz as buscas sempre que essa aba específica se tornar ativa de novo
    widget.tabController?.addListener(_aoTrocarDeAba);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      _timer = Timer.periodic(const Duration(seconds: 4), (_) {
        final atual = context.read<EventsListProvider>().weekEvents;
        if (atual.isEmpty) return;
        _currentPage = (_currentPage + 1) % atual.length;
        _pageController.animateToPage(
          _currentPage,
          duration: const Duration(milliseconds: 700),
          curve: Curves.easeInOut,
        );
      });

      _offersTimer = Timer.periodic(const Duration(seconds: 5), (_) {
        if (!_offersController.hasClients) return;
        _currentOffer++;
        _offersController.animateToPage(
          _currentOffer,
          duration: const Duration(milliseconds: 600),
          curve: Curves.easeInOut,
        );
      });
    });
  }

  void _aoTrocarDeAba() {
    final controller = widget.tabController;
    final indice = widget.tabIndex;
    if (controller == null || indice == null) return;

    if (controller.index == indice && !controller.indexIsChanging) {
      context.read<EventsListProvider>().fetchFeaturedEvents();
      context.read<EventsListProvider>().fetchWeekEvents();
    }
  }

  @override
  void dispose() {
    widget.tabController?.removeListener(_aoTrocarDeAba);
    _timer.cancel();
    _offersTimer.cancel();
    _pageController.dispose();
    _offersController.dispose();
    super.dispose();
  }

  List<ExclusiveOffersModel> get offers => [
    ExclusiveOffersModel(
      imgURL: 'assets/img/descontoMocado/Firula.jpg',
      lugar: "Firula Bar",
      desconto: 15,
      condicao: "Novos Clientes",
    ),
    ExclusiveOffersModel(
      imgURL: 'assets/img/descontoMocado/Corona.jpg',
      lugar: "Trinca Bar",
      desconto: 20,
      condicao: "Novos Clientes",
    ),
    ExclusiveOffersModel(
      imgURL: 'assets/img/descontoMocado/Folks.jpg',
      lugar: "Folks",
      desconto: 10,
      condicao: "Novos Clientes",
    ),
    ExclusiveOffersModel(
      imgURL: 'assets/img/descontoMocado/Drink Obscuro.jpg',
      lugar: "Obscuro",
      desconto: 12,
      condicao: "Novos Clientes",
    ),
    ExclusiveOffersModel(
      imgURL: 'assets/img/descontoMocado/Drink Rosa.jpg',
      lugar: "Douha",
      desconto: 9,
      condicao: "Novos Clientes",
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final eventsProvider = context.watch<EventsListProvider>();

    return Scaffold(
      backgroundColor: context.colors.noturno,
      body: RefreshIndicator(
        color: context.colors.ambar,
        onRefresh: () => Future.wait([
          context.read<EventsListProvider>().fetchFeaturedEvents(force: true),
          context.read<EventsListProvider>().fetchWeekEvents(force: true),
          context.read<PlaceListProvider>().fetchPlaces(force: true),
        ]),
        child: ListView(
          children: [
            Padding(
              padding: const EdgeInsets.only(top: 20),
              child: SizedBox(
                height: 270,
                child:
                    eventsProvider.isLoadingFeatured &&
                        eventsProvider.featuredEvents.isEmpty
                    ? Center(
                        child: CircularProgressIndicator(
                          color: context.colors.ambar,
                        ),
                      )
                    : eventsProvider.featuredEvents.isEmpty
                    ? Center(
                        child: Text(
                          'Nenhum evento em destaque',
                          style: TextStyle(
                            color: context.colors.textDisabled,
                            fontSize: 14,
                          ),
                        ),
                      )
                    : PageView.builder(
                        padEnds: false,
                        controller: PageController(viewportFraction: 0.95),
                        itemCount: eventsProvider.featuredEvents.length,
                        itemBuilder: (context, index) {
                          return FeaturedEvents(
                            event: eventsProvider.featuredEvents[index],
                          );
                        },
                      ),
              ),
            ),

            const SizedBox(height: 20),

            Padding(
              padding: EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                children: [
                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      "Categorias",
                      style: GoogleFonts.inter(
                        color: context.colors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  CategoryHighlightsSection(),
                  const SizedBox(height: 30),

                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      "Descubra",
                      style: GoogleFonts.inter(
                        color: context.colors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                      ),
                    ),
                  ),
                  const SizedBox(height: 30),
                  LineupPlaceIndicator(),
                  const SizedBox(height: 10),

                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      "Eventos da Semana",
                      style: GoogleFonts.inter(
                        color: context.colors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                      ),
                    ),
                  ),

                  Padding(
                    padding: const EdgeInsets.only(top: 20),
                    child: SizedBox(
                      height: 270,
                      child:
                          eventsProvider.isLoadingWeek &&
                              eventsProvider.weekEvents.isEmpty
                          ? Center(
                              child: CircularProgressIndicator(
                                color: context.colors.ambar,
                              ),
                            )
                          : eventsProvider.weekEvents.isEmpty
                          ? Center(
                              child: Text(
                                'Nenhum evento esta semana',
                                style: TextStyle(
                                  color: context.colors.textDisabled,
                                  fontSize: 14,
                                ),
                              ),
                            )
                          : PageView.builder(
                              padEnds: false,
                              controller: _pageController,
                              onPageChanged: (index) =>
                                  setState(() => _currentPage = index),
                              itemCount: eventsProvider.weekEvents.length,
                              itemBuilder: (context, index) {
                                return WeeklyEvents(
                                  evento: eventsProvider.weekEvents[index],
                                );
                              },
                            ),
                    ),
                  ),

                  const SizedBox(height: 40),

                  Align(
                    alignment: Alignment.centerLeft,
                    child: Text(
                      "Ofertas Exclusivas",
                      style: GoogleFonts.inter(
                        color: context.colors.textPrimary,
                        fontWeight: FontWeight.bold,
                        fontSize: 22,
                      ),
                    ),
                  ),

                  const SizedBox(height: 20),
                  SizedBox(
                    height: 150,
                    child: PageView.builder(
                      padEnds: false,
                      controller: _offersController,
                      itemCount: 9999,
                      itemBuilder: (context, index) {
                        final offer = offers[index % offers.length];
                        return Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 8),
                          child: ExclusiveOffers(offer: offer),
                        );
                      },
                    ),
                  ),
                  const SizedBox(height: 30),

                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        "Perto de Você",
                        style: GoogleFonts.inter(
                          color: context.colors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 22,
                        ),
                      ),
                      _atualizandoLocalizacao
                          ? Padding(
                              padding: const EdgeInsets.all(12),
                              child: SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  color: context.colors.textPrimary,
                                  strokeWidth: 2.5,
                                ),
                              ),
                            )
                          : IconButton(
                              icon: Icon(
                                Icons.sync,
                                color: context.colors.textPrimary,
                                size: 27,
                              ),
                              onPressed: _atualizarLocalizacaoManualmente,
                            ),
                    ],
                  ),

                  const SizedBox(height: 20),
                  FutureBuilder<void>(
                    // Aguarda a mesma Future que o home_tab.dart guardou ao capturar a localização
                    future: localizacaoFuture,
                    builder: (context, snapshot) {
                      if (localizacaoFuture != null &&
                          snapshot.connectionState == ConnectionState.waiting) {
                        return Center(
                          child: Padding(
                            padding: const EdgeInsets.symmetric(vertical: 24),
                            child: CircularProgressIndicator(
                              color: context.colors.ambar,
                            ),
                          ),
                        );
                      }

                      if (latitudeAtual == null || longitudeAtual == null) {
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
                              'Não foi possível acessar sua localização. '
                              'Verifique se o GPS está ativado e se o app '
                              'tem permissão de localização.',
                              textAlign: TextAlign.center,
                              style: TextStyle(
                                color: context.colors.textDisabled,
                                fontSize: 14,
                              ),
                            ),
                          ],
                        );
                      }

                      return CloseToYou();
                    },
                  ),
                  const SizedBox(height: 10),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
