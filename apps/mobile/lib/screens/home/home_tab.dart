import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/screens/feed/feed_screen.dart';
import 'package:mobile/screens/highlights/highlights_section_screen.dart';
import 'package:mobile/screens/places/hot_places_screen.dart';
import 'package:mobile/service/location/location_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/location_satate.dart';

class HomeTab extends StatefulWidget {
  //serve só pra passar o valor atual da barra pra tela do feed
  final ValueNotifier<bool> navbarVisibleNotifier;
  // volta com a barra ao trocar de aba
  final VoidCallback onTabChanged;

  const HomeTab({
    super.key,
    required this.navbarVisibleNotifier,
    required this.onTabChanged,
  });

  @override
  State<HomeTab> createState() => HomeTabState();
}

class HomeTabState extends State<HomeTab> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _locationService = LocationService();

  // Indice da aba destaques pra função de localização
  static const int _abaDestaquesIndex = 1;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    // Escuta qualquer troca de aba, serve para fazer a barra voltar ao trocar de aba
    _tabController.addListener(() {
      widget.onTabChanged();

      // Atualiza a localização sempre que a aba Destaques se torna ativa
      if (_tabController.index == _abaDestaquesIndex &&
          !_tabController.indexIsChanging) {
        localizacaoFuture = _atualizarLocalizacao();
      }
    });
  }

  Future<void> _atualizarLocalizacao() async {
    latitudeAtual = null;
    longitudeAtual = null;

    try {
      final posicao = await _locationService.getCurrentPosition();
      latitudeAtual = posicao.latitude;
      longitudeAtual = posicao.longitude;
      debugPrint('Localização: lat=$latitudeAtual, lng=$longitudeAtual');
    } catch (e) {
      debugPrint('Erro ao obter localização: $e');
    }
  }

  /// Usado pelo botao voltar do Android: informa se a aba FEED esta ativa.
  bool get isOnFeedTab => _tabController.index == 0;

  /// Usado pelo botao voltar do Android: retorna para a aba FEED.
  void goToFeedTab() => _tabController.animateTo(0);

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.darkGrey,
      appBar: AppBar(
        toolbarHeight: 45,
        automaticallyImplyLeading: false,
        backgroundColor: context.colors.navy,
        foregroundColor: context.colors.ambar,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            color: context.colors.navy,
            boxShadow: [
              BoxShadow(
                color: context.colors.border.withOpacity(0.1),
                blurRadius: 8,
                offset: const Offset(0, 1),
              ),
            ],
          ),
        ),
        title: Image.asset(
          'assets/img/logo/tipografia.png',
          height: 20,
          fit: BoxFit.contain,
        ),
        centerTitle: true,
        bottom: TabBar(
          controller: _tabController,
          unselectedLabelColor: context.colors.textMuted,
          labelColor: context.colors.ambar,
          dividerColor: Colors.transparent,
          indicatorColor: context.colors.ambar,
          labelPadding: const EdgeInsets.all(10),
          labelStyle: GoogleFonts.inter(
            fontSize: Platform.isIOS ? 14 : 16,
            fontWeight: FontWeight.bold,
          ),
          tabs: const <Widget>[
            Tab(text: 'FEED'),
            Tab(text: 'DESTAQUES'),
            Tab(text: 'EM ALTA'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          //Chama passando o estado da barra
          FeedScreen(navbarVisibleNotifier: widget.navbarVisibleNotifier),
          HighlightsSectionScreen(
            tabController: _tabController,
            tabIndex: _abaDestaquesIndex,
          ),
          HotPlacesScreen(),
        ],
      ),
    );
  }
}