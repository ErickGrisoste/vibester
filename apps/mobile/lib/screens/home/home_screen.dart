import 'package:flutter/material.dart';
import 'package:mobile/providers/notification/notification_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/screens/favorites/user_favorites_screen.dart';
import 'package:mobile/screens/home/home_tab.dart';
import 'package:mobile/screens/search/search_screen.dart';
import 'package:mobile/screens/user/user_profile_screen.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/navbar/custom_navbar.dart';
import 'package:provider/provider.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  static const _profileTabIndex = 3;

  int _currentIndex = 0;
  bool _navbarVisible = true;
  bool _isTabSwitching = false; // Bloqueia o listener durante a troca de aba
  final _navbarVisibleNotifier = ValueNotifier<bool>(true);
  final _profileKey = GlobalKey<UserProfileScreenState>();

  // Instanciadas uma única vez para manter o estado (e o cache de imagens já
  // carregadas) de cada aba ao trocar entre elas.
  late final List<Widget> _screens = [
    HomeTab(
      navbarVisibleNotifier: _navbarVisibleNotifier,
      onTabChanged: () {
        // Reseta a barra ao trocar de aba pelo TabBar ou swipe
        setState(() => _navbarVisible = true);
        _navbarVisibleNotifier.value = true;
      },
    ),
    SearchScreen(),
    UserFavoritesScreen(),
    UserProfileScreen(key: _profileKey),
  ];

  @override
  void dispose() {
    _navbarVisibleNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.noturno,
      extendBody: true,
      body: NotificationListener<ScrollNotification>(
        //Serve para definir o estado. Controla tmb o botão da tela de feed pra sumir junto da barra. Tmb valida pra não sumir com PageView
        onNotification: (notification) {
          if (_isTabSwitching)
            return false; // Ignora scroll durante troca de aba

          if (notification is ScrollUpdateNotification &&
              notification.metrics.axis == Axis.vertical) {
            final delta = notification.scrollDelta ?? 0;

            if (delta > 2 && _navbarVisible) {
              setState(() => _navbarVisible = false);
              _navbarVisibleNotifier.value = false;
            } else if (delta < -2 && !_navbarVisible) {
              setState(() => _navbarVisible = true);
              _navbarVisibleNotifier.value = true;
            }
          }
          return false;
        },
        child: IndexedStack(index: _currentIndex, children: _screens),
      ),
      bottomNavigationBar: IgnorePointer(
        ignoring: !_navbarVisible,
        child: AnimatedSlide(
          offset: _navbarVisible ? Offset.zero : const Offset(0, 1),
          duration: const Duration(milliseconds: 300),
          curve: Curves.easeInOut,
          child: AnimatedOpacity(
            opacity: _navbarVisible ? 1.0 : 0.0,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
            child: CustomNavbar(
              currentIndex: _currentIndex,
              //Serve pra todas as telas resetarem ao trocar de tela, pra não perder a barra
              onTap: (index) {
                setState(() {
                  _currentIndex = index;
                  _navbarVisible = true;
                  _navbarVisibleNotifier.value = true;
                  _isTabSwitching = true;
                });
                Future.delayed(const Duration(milliseconds: 400), () {
                  if (mounted) setState(() => _isTabSwitching = false);
                });

                // Refresh leve do badge de notificações a cada troca de aba
                // (não há infra de push para atualizar em tempo real).
                final userId = context.read<UserProvider>().user?.accountId;
                if (userId != null) {
                  context.read<NotificationProvider>().fetchUnreadCount(userId);
                }

                // As telas do IndexedStack são montadas uma única vez, então
                // a aba de perfil não busca dados novos sozinha ao ser
                // selecionada — atualiza manualmente aqui.
                if (index == _profileTabIndex) {
                  _profileKey.currentState?.refreshProfileData();
                }
              },
            ),
          ),
        ),
      ),
    );
  }
}
