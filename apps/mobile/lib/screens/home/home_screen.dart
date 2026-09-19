import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/providers/safety/block_provider.dart';
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

class _HomeScreenState extends State<HomeScreen> with WidgetsBindingObserver {
  static const _feedIndex = 0;
  static const _exploreIndex = 1;
  static const _todayIndex = 2;
  static const _profileIndex = 3;

  /// Tela inicial do produto — hoje o FEED.
  static const _homeIndex = _feedIndex;

  int _currentIndex = _homeIndex;
  bool _dockVisible = true;

  final _feedKey = GlobalKey<FeedScreenState>();
  final _exploreKey = GlobalKey<ExploreScreenState>();
  final _todayKey = GlobalKey<TodayScreenState>();
  final _profileKey = GlobalKey<UserProfileScreenState>();

  /// Momento do último toque no voltar do Android, para o padrão "aperte
  /// duas vezes para sair".
  DateTime? _lastBackPress;

  /// Instanciadas uma vez só: trocar de destino não deve descartar o estado
  /// (posição de scroll, imagens já carregadas) do destino anterior.
  late final List<Widget> _destinations = [
    FeedScreen(key: _feedKey),
    ExploreScreen(key: _exploreKey),
    TodayScreen(key: _todayKey),
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

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);

    // O contador não vinha de lugar nenhum em quem entrava pelo login: só o
    // boot com sessão salva o buscava, e a troca de destino (que sai cedo
    // quando o índice não muda). Resultado: sino sem selo até o usuário
    // trocar de aba na mão, o que lia como "não chega notificação".
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _refreshUnreadCount();
      _loadBlocks();
    });
  }

  /// Lista de perfis bloqueados, para feed e busca esconderem na hora.
  void _loadBlocks() {
    if (!mounted) return;
    final userId = context.read<UserProvider>().user?.accountId;
    if (userId == null) return;
    context.read<BlockProvider>().load(userId);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// O app fica aberto por longos períodos numa aba só. Sem isto o selo
  /// congela no valor de quando a tela montou: quem volta do segundo plano
  /// nunca vê o contador subir.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _refreshUnreadCount();
    }
  }

  /// Leitura leve do contador de não lidas. Não mexe na lista carregada nem
  /// mostra loading, então pode ser chamada sempre que houver chance de o
  /// número ter mudado.
  void _refreshUnreadCount() {
    if (!mounted) return;

    final userId = context.read<UserProvider>().user?.accountId;
    if (userId == null) return;

    context.read<NotificationProvider>().fetchUnreadCount(userId);
  }

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
    // Tocar no destino em que já se está reinicia a tela, em vez de não fazer
    // nada: é o atalho de volta ao começo sem precisar rolar nem desfazer
    // filtro por filtro.
    if (index == _currentIndex) {
      _resetDestination(index);
      return;
    }

    setState(() {
      _currentIndex = index;
      _dockVisible = true;
    });

    // Não há push, então o badge não se atualiza sozinho: uma leitura leve a
    // cada troca de destino é o suficiente e não custa uma tela de loading.
    _refreshUnreadCount();

    // As telas do IndexedStack são montadas uma única vez, então o perfil não
    // busca dados novos sozinho ao voltar a ficar visível.
    if (index == _profileIndex) {
      _profileKey.currentState?.refreshProfileData();
    }
  }

  /// Cada destino sabe o que "voltar ao começo" significa para ele:
  ///
  /// * FEED — sobe até o topo.
  /// * BUSCA — limpa o termo, fecha o teclado e volta à descoberta.
  /// * HOJE — sobe, tira o filtro de categoria e recarrega tudo.
  /// * VOCÊ — sobe e recarrega perfil e registros.
  void _resetDestination(int index) {
    if (!_dockVisible) setState(() => _dockVisible = true);

    switch (index) {
      case _feedIndex:
        _feedKey.currentState?.scrollToTop();
      case _exploreIndex:
        _exploreKey.currentState?.resetTab();
      case _todayIndex:
        _todayKey.currentState?.resetTab();
      case _profileIndex:
        _profileKey.currentState?.resetTab();
    }
  }

  Future<void> _openComposer() async {
    final published = await Navigator.pushNamed(
      context,
      AppRoutes.newPublication,
    );
    // Fechou sem publicar: fica onde estava.
    if (!mounted || published != true) return;

    // Publicou: leva pro FEED, no topo, onde o composer já colocou o post — a
    // ação termina mostrando o resultado dela. Sem refresh: o feed-service grava
    // o post no feed do autor de forma assíncrona, então a busca feita agora
    // provavelmente ainda viria sem ele.
    setState(() {
      _currentIndex = _feedIndex;
      _dockVisible = true;
    });
    _feedKey.currentState?.scrollToTop();
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
          // As notificações moram no sino do cabeçalho de HOJE. O selo estava
          // apontando para VOCÊ — sobra de quando elas ficavam dentro do
          // perfil, e que mandava o usuário procurar no lugar errado.
          badgeIndex: _todayIndex,
          badgeCount: unread,
          visible: _dockVisible,
        ),
      ),
    );
  }
}