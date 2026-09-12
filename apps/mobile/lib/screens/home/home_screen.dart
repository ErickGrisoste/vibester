import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/notification/notification_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/screens/explore/explore_screen.dart';
import 'package:mobile/screens/feed/feed_screen.dart';
import 'package:mobile/screens/home/today_screen.dart';
import 'package:mobile/screens/user/user_profile_screen.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/navigation/vibester_navbar.dart';
import 'package:provider/provider.dart';

/// Casca de navegação do app.
///
/// A arquitetura anterior tinha **duas** navegações empilhadas: quatro abas
/// embaixo (home / busca / favoritos / perfil) e, dentro da primeira, mais
/// três abas no topo (FEED / DESTAQUES / EM ALTA). Isso significava que o
/// conteúdo mais importante do produto — o que está acontecendo hoje — ficava
/// atrás de uma aba dentro de uma aba, e que o botão voltar precisava de uma
/// máquina de estados só pra saber onde o usuário estava.
///
/// Aqui existe uma navegação só, com quatro destinos e uma ação:
///
/// * **FEED** — o social: o que as pessoas estão postando (tela inicial).
/// * **EXPLORAR** — busca ativa: categorias, lugares, eventos, pessoas.
/// * **(+)** — publicar (ação, não destino: volta pra onde o usuário estava).
/// * **HOJE** — descoberta: o que está rolando agora, perto, nesta semana.
/// * **VOCÊ** — identidade, salvos e ajustes.
///
/// Favoritos deixou de ser um destino de primeiro nível (virou uma seção
/// dentro de VOCÊ, junto da identidade — que é onde o usuário procura o que
/// ele mesmo salvou) e notificações saíram de dentro da aba de favoritos, um
/// lugar onde ninguém as encontraria, para o sino do cabeçalho de HOJE.
class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _feedIndex = 0;
  static const _profileIndex = 3;

  /// Tela inicial do produto — hoje o FEED.
  static const _homeIndex = _feedIndex;

  int _currentIndex = _homeIndex;
  bool _dockVisible = true;

  final _profileKey = GlobalKey<UserProfileScreenState>();

  /// Momento do último toque no voltar do Android, para o padrão "aperte
  /// duas vezes para sair".
  DateTime? _lastBackPress;

  /// Instanciadas uma vez só: trocar de destino não deve descartar o estado
  /// (posição de scroll, imagens já carregadas) do destino anterior.
  late final List<Widget> _destinations = [
    const FeedScreen(),
    const ExploreScreen(),
    const TodayScreen(),
    UserProfileScreen(key: _profileKey),
  ];

  static const _navDestinations = [
    NavbarDestination(
      icon: Icons.dynamic_feed_outlined,
      activeIcon: Icons.dynamic_feed,
      label: 'FEED',
    ),
    NavbarDestination(
      icon: Icons.explore_outlined,
      activeIcon: Icons.explore,
      label: 'BUSCA',
    ),
    NavbarDestination(
      icon: Icons.bolt_outlined,
      activeIcon: Icons.bolt,
      label: 'HOJE',
    ),
    NavbarDestination(
      icon: Icons.person_outline_rounded,
      activeIcon: Icons.person_rounded,
      label: 'VOCÊ',
    ),
  ];

  void _handleBackPress() {
    // Qualquer destino que não seja a tela inicial volta pra ela — a tela
    // inicial do produto é uma só, e sair do app nunca acontece por acidente
    // no meio da navegação.
    if (_currentIndex != _homeIndex) {
      setState(() {
        _currentIndex = _homeIndex;
        _dockVisible = true;
      });
      return;
    }

    final now = DateTime.now();
    final isSecondPress =
        _lastBackPress != null &&
        now.difference(_lastBackPress!) <= const Duration(seconds: 2);

    if (isSecondPress) {
      SystemNavigator.pop();
      return;
    }

    _lastBackPress = now;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Aperte voltar de novo pra sair'),
        duration: Duration(seconds: 2),
      ),
    );
  }

  void _selectDestination(int index) {
    if (index == _currentIndex) return;

    setState(() {
      _currentIndex = index;
      _dockVisible = true;
    });

    // Não há push, então o badge não se atualiza sozinho: uma leitura leve a
    // cada troca de destino é o suficiente e não custa uma tela de loading.
    final userId = context.read<UserProvider>().user?.accountId;
    if (userId != null) {
      context.read<NotificationProvider>().fetchUnreadCount(userId);
    }

    // As telas do IndexedStack são montadas uma única vez, então o perfil não
    // busca dados novos sozinho ao voltar a ficar visível.
    if (index == _profileIndex) {
      _profileKey.currentState?.refreshProfileData();
    }
  }

  Future<void> _openComposer() async {
    await Navigator.pushNamed(context, AppRoutes.newPublication);
    if (!mounted) return;

    // Publicou: leva pro FEED, que é onde o post aparece — a ação termina
    // mostrando o resultado dela, não devolvendo o usuário pra tela anterior
    // sem explicação.
    final userId = context.read<UserProvider>().user?.accountId;
    setState(() {
      _currentIndex = _feedIndex;
      _dockVisible = true;
    });
    if (userId != null) {
      context.read<PublicationListProvider>().fetchPublications(
        userId,
        force: true,
      );
    }
  }

  /// Esconde o dock ao descer e devolve ao subir. O gesto é o mesmo em todos
  /// os destinos, então mora aqui e não em cada tela.
  bool _onScroll(ScrollNotification notification) {
    if (notification is! ScrollUpdateNotification) return false;
    if (notification.metrics.axis != Axis.vertical) return false;

    final delta = notification.scrollDelta ?? 0;
    if (delta > 3 && _dockVisible) {
      setState(() => _dockVisible = false);
    } else if (delta < -3 && !_dockVisible) {
      setState(() => _dockVisible = true);
    }
    return false;
  }

  @override
  Widget build(BuildContext context) {
    final unread = context.watch<NotificationProvider>().unreadCount;

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (didPop) return;
        _handleBackPress();
      },
      child: Scaffold(
        backgroundColor: context.colors.noturno,
        extendBody: true,
        body: NotificationListener<ScrollNotification>(
          onNotification: _onScroll,
          // Aba escondida fica montada (preserva estado e rolagem), mas com
          // o ticker mudo: nada anima fora da tela, e o vídeo do feed pausa.
          child: IndexedStack(
            index: _currentIndex,
            children: [
              for (final (i, destination) in _destinations.indexed)
                TickerMode(enabled: i == _currentIndex, child: destination),
            ],
          ),
        ),
        // Esconder/mostrar no scroll é intenção declarada aqui; a coreografia
        // (deslocamento, opacidade, duração) vive dentro da navbar.
        bottomNavigationBar: VibesterNavbar(
          destinations: _navDestinations,
          currentIndex: _currentIndex,
          onDestinationSelected: _selectDestination,
          onCreate: _openComposer,
          badgeIndex: _profileIndex,
          badgeCount: unread,
          visible: _dockVisible,
        ),
      ),
    );
  }
}
