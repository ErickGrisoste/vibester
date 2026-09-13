import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/service/media/image_cache.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/auth_storage_service.dart';
import 'package:mobile/service/event/event_service.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/notification/notification_provider.dart';
import 'package:mobile/providers/place/nearby_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/providers/theme/theme_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/theme/theme_service.dart';
import 'package:mobile/service/user/interests_storage.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/theme/vibester_page_route.dart';
import 'package:mobile/screens/events/event_detail_screen.dart';
import 'package:mobile/screens/events/event_list_screen.dart';
import 'package:mobile/screens/events/favorites_events_screen.dart';
import 'package:mobile/screens/feed/feed_screen.dart';
import 'package:mobile/screens/feed/new_publication_screen.dart';
import 'package:mobile/screens/home/home_screen.dart';
import 'package:mobile/screens/home/initial_screen.dart';
import 'package:mobile/screens/notification/notifications_screen.dart';
import 'package:mobile/screens/saved/saved_screen.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mobile/screens/onboarding/onboarding_screen.dart';
import 'package:mobile/screens/places/favorite_places_screen.dart';
import 'package:mobile/screens/places/hot_places_screen.dart';
import 'package:mobile/screens/places/place_detail_screen.dart';
import 'package:mobile/screens/register/email_confirm_screen.dart';
import 'package:mobile/screens/register/login_screen.dart';
import 'package:mobile/screens/register/recover_password_screen.dart';
import 'package:mobile/screens/register/register_screen.dart';
import 'package:mobile/screens/register/reset_password_screen.dart';
import 'package:mobile/screens/explore/explore_screen.dart';
import 'package:mobile/screens/settings/personal_information_settings_screen.dart';
import 'package:mobile/screens/settings/settings_screen.dart';
import 'package:mobile/screens/user/other_users_profile_screen.dart';
import 'package:mobile/screens/user/profile_editing_screen.dart';
import 'package:mobile/screens/user/user_interests_screen.dart';
import 'package:mobile/screens/user/user_profile_screen.dart';
import 'package:mobile/widgets/cards/highlights/post_detail_screen.dart';
import 'package:provider/provider.dart';

// Builders de transição de rota (fade+slide+scale compostos) vivem em
// lib/theme/vibester_page_route.dart: vibesterSlideRoute, vibesterFadeRoute,
// vibesterDetailRoute — usados abaixo, no onGenerateRoute.

//Classe que da ao scroll uma propriedade especifica
class _NoBounceScrollBehavior extends ScrollBehavior {
  @override
  ScrollPhysics getScrollPhysics(BuildContext context) {
    return const ClampingScrollPhysics();
  }
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Limites do cache de imagem em memória — o motivo de cada número vive
  // junto do cache de disco, em lib/service/media/image_cache.dart.
  VibesterImageCache.configureMemoryCache();

  await initializeDateFormatting('pt_BR', null);
  // Interesses escolhidos no onboarding: restaurados antes da primeira tela
  // pra a régua de categorias da Home já nascer na ordem do usuário.
  await InterestsStorage.restore();
  var savedUser = await AuthStorageService.loadSession();
  final etapaPendente = await AuthStorageService.etapaPendente();
  // JWT vencido não é sessão: restaurar abriria a home com o feed recusando
  // tudo com 401. Descarta e começa pela tela inicial.
  final savedToken = savedUser?.token;
  // Guardado para a interface: descartar a sessão em silêncio faz o usuário
  // abrir o app, cair na tela inicial e achar que perdeu tudo. O 401 em tempo
  // de uso já explica o que houve (ver `_handleSessionExpired`); o boot
  // precisava fazer o mesmo.
  var sessaoExpirada = false;
  if (savedToken != null && ApiClient.isTokenExpired(savedToken)) {
    await AuthStorageService.clearSession();
    savedUser = null;
    sessaoExpirada = true;
  }
  if (savedUser?.token != null) {
    ApiClient.token = savedUser!.token;
  }
  final initialThemeMode = await ThemeService.loadThemeMode();
  runApp(
    MyApp(
      savedUser: savedUser,
      etapaPendente: etapaPendente,
      initialThemeMode: initialThemeMode,
      sessaoExpirada: sessaoExpirada,
    ),
  );
}

class MyApp extends StatefulWidget {
  final UserModel? savedUser;
  final ThemeMode initialThemeMode;

  /// Passo do cadastro deixado pela metade, ou `null` se não há.
  final EtapaCadastro? etapaPendente;

  /// A sessão salva foi descartada no boot por token vencido. O app avisa e
  /// leva ao login, em vez de abrir a capa como se nunca tivesse havido conta.
  final bool sessaoExpirada;

  const MyApp({
    super.key,
    this.savedUser,
    this.etapaPendente,
    required this.initialThemeMode,
    this.sessaoExpirada = false,
  });

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  final AppLinks _appLinks = AppLinks();
  final UserService _userService = UserService();
  final EventService _eventService = EventService();
  StreamSubscription<Uri>? _linkSubscription;

  @override
  void initState() {
    super.initState();
    ApiClient.onSessionExpired = _handleSessionExpired;
    _initDeepLinks();

    if (widget.sessaoExpirada) {
      // Depois do primeiro frame: antes disso não existe navigator nem
      // messenger para receber isso.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _avisarSessaoExpirada();
      });
    }
  }

  /// Leva ao login com a explicação. Mesma pilha e mesma mensagem do caminho
  /// de 401 em tempo de uso, para as duas formas de perder a sessão terminarem
  /// no mesmo lugar.
  void _avisarSessaoExpirada() {
    final navigator = _navigatorKey.currentState;
    if (navigator == null) return;

    navigator.pushNamed(AppRoutes.login);
    ScaffoldMessenger.of(navigator.context).showSnackBar(
      const SnackBar(content: Text('Sua sessão expirou. Entra de novo.')),
    );
  }

  // 401 numa rota autenticada: o token venceu. Encerra a sessão pelos dois
  // lados (memória e storage seguro, via UserProvider.logout) e volta ao
  // login, mesma pilha do "Sair" das configurações.
  Future<void> _handleSessionExpired() async {
    final navigator = _navigatorKey.currentState;
    if (navigator == null) return;

    final messenger = ScaffoldMessenger.of(navigator.context);
    final userProvider = navigator.context.read<UserProvider>();
    if (userProvider.user == null) return;

    await userProvider.logout();
    if (!mounted) return;

    navigator.pushNamedAndRemoveUntil(AppRoutes.initialScreen, (_) => false);
    navigator.pushNamed(AppRoutes.login);
    messenger.showSnackBar(
      const SnackBar(content: Text('Sua sessão expirou. Entra de novo.')),
    );
  }

  Future<void> _initDeepLinks() async {
    final initialUri = await _appLinks.getInitialLink();
    if (initialUri != null) _handleUri(initialUri);

    _linkSubscription = _appLinks.uriLinkStream.listen(_handleUri);
  }

  // Espera vibester://profile/{token} (token gerado por
  // UserService.generateShareLink no backend), vibester://event/{id} e
  // vibester://place/{id} (links de ShareLinks). Quem chega pelo link vem da
  // landing page, que monta esses endereços.
  Future<void> _handleUri(Uri uri) async {
    if (uri.scheme != 'vibester') return;
    final segment = uri.pathSegments.isNotEmpty ? uri.pathSegments.first : null;
    if (segment == null) return;

    final navigator = _navigatorKey.currentState;
    if (navigator == null) return;

    switch (uri.host) {
      case 'profile':
        return _openSharedProfile(navigator, segment);
      case 'event':
        return _openSharedEvent(navigator, segment);
      case 'place':
        // PlaceDetailScreen já busca pelo id e trata o não encontrado.
        navigator.pushNamed(AppRoutes.placeDetail, arguments: segment);
    }
  }

  // A rota de detalhe recebe o EventModel pronto (vem de um card), então o
  // link busca o evento antes de abrir.
  Future<void> _openSharedEvent(
    NavigatorState navigator,
    String eventId,
  ) async {
    final messenger = ScaffoldMessenger.of(navigator.context);
    try {
      final event = await _eventService.getEventById(eventId);
      if (!mounted) return;
      navigator.pushNamed(AppRoutes.eventDetail, arguments: event);
    } catch (e) {
      debugPrint('Falha ao abrir evento compartilhado: $e');
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Não foi possível abrir esse rolê agora.'),
        ),
      );
    }
  }

  Future<void> _openSharedProfile(
    NavigatorState navigator,
    String token,
  ) async {

    // Capturados antes do await: depois dele o context do navigator pode ter
    // sido desmontado, e usá-lo cruzando o gap assíncrono é o que o
    // use_build_context_synchronously alerta.
    final messenger = ScaffoldMessenger.of(navigator.context);
    final currentUserId = navigator.context
        .read<UserProvider>()
        .user
        ?.accountId;

    try {
      final resolvedAccountId = await _userService.resolveShareToken(token);
      if (!mounted) return;

      if (resolvedAccountId == null) {
        messenger.showSnackBar(
          const SnackBar(
            content: Text(
              'Este link de compartilhamento expirou ou é inválido.',
            ),
          ),
        );
        return;
      }

      if (resolvedAccountId == currentUserId) {
        navigator.pushNamed(AppRoutes.profile);
      } else {
        navigator.pushNamed(
          AppRoutes.otherProfile,
          arguments: resolvedAccountId,
        );
      }
    } catch (e) {
      // Mensagem tratada na tela; o detalhe da exceção fica no log local.
      debugPrint('Falha ao abrir link compartilhado: $e');
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(
          content: Text('Não foi possível abrir esse link agora.'),
        ),
      );
    }
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    ApiClient.onSessionExpired = null;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final userProvider = UserProvider();
    final notificationProvider = NotificationProvider();
    final themeProvider = ThemeProvider(widget.initialThemeMode);
    if (widget.savedUser != null) {
      userProvider.setUser(widget.savedUser!);
      if (widget.savedUser!.accountId != null) {
        notificationProvider.fetchUnreadCount(widget.savedUser!.accountId!);
      }
    }

    return MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => PlaceListProvider()),
        ChangeNotifierProvider(create: (_) => NearbyProvider()),
        ChangeNotifierProvider(create: (_) => EventsListProvider()),
        ChangeNotifierProvider(create: (_) => PublicationListProvider()),
        ChangeNotifierProvider.value(value: userProvider),
        ChangeNotifierProvider.value(value: notificationProvider),
        ChangeNotifierProvider.value(value: themeProvider),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, _) => MaterialApp(
          navigatorKey: _navigatorKey,
          debugShowCheckedModeBanner: false,
          //Chama a classe da propriedade de scroll
          scrollBehavior: _NoBounceScrollBehavior(),
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: themeProvider.themeMode,
          // A conta nasce na confirmação do e-mail, mas o cadastro só termina
          // na apresentação. Fechar o app entre os dois deixa uma etapa
          // gravada, e é ela que diz onde retomar — sem isso o app abria na
          // home com perfil e interesses em branco, sem perguntar mais nada.
          initialRoute: widget.savedUser == null
              ? AppRoutes.initialScreen
              : switch (widget.etapaPendente) {
                  EtapaCadastro.perfil => AppRoutes.profileEditing,
                  EtapaCadastro.interesses => AppRoutes.userInterestsSetup,
                  EtapaCadastro.apresentacao => AppRoutes.onboarding,
                  null => AppRoutes.home,
                },
          onGenerateRoute: (settings) {
            switch (settings.name) {
              // EVENTS
              case AppRoutes.eventList:
                return vibesterSlideRoute(
                  const EventListScreen(showHeader: true),
                  settings,
                );
              case AppRoutes.favoritesEvents:
                return vibesterSlideRoute(
                  const FavoritesEventsScreen(),
                  settings,
                );
              case AppRoutes.eventDetail:
                final event = settings.arguments as EventModel;
                return vibesterDetailRoute(
                  EventDetailScreen(eventModel: event),
                  settings,
                );

              // PLACES
              case AppRoutes.favoritesPlaces:
                return vibesterSlideRoute(
                  const FavoritePlacesScreen(),
                  settings,
                );
              case AppRoutes.hotPlaces:
                return vibesterSlideRoute(const HotPlacesScreen(), settings);
              case AppRoutes.placeDetail:
                final placeId = settings.arguments as String;
                return vibesterDetailRoute(
                  PlaceDetailScreen(placeId: placeId),
                  settings,
                );

              // HOME
              case AppRoutes.home:
                return vibesterFadeRoute(const HomeScreen(), settings);
              case AppRoutes.initialScreen:
                return vibesterFadeRoute(const InitialScreen(), settings);

              // ONBOARDING
              case AppRoutes.onboarding:
                return vibesterFadeRoute(const OnboardingScreen(), settings);

              // REGISTER
              case AppRoutes.emailConfirm:
                final args = settings.arguments as Map<String, String>;
                return vibesterFadeRoute(
                  EmailConfirmScreen(
                    email: args['email']!,
                    senha: args['senha']!,
                  ),
                  settings,
                );
              case AppRoutes.login:
                return vibesterFadeRoute(const LoginScreen(), settings);
              case AppRoutes.recoverPassword:
                return vibesterFadeRoute(
                  const RecoverPasswordScreen(),
                  settings,
                );
              case AppRoutes.register:
                return vibesterFadeRoute(const RegisterScreen(), settings);
              case AppRoutes.resetPassword:
                return vibesterFadeRoute(const ResetPasswordScreen(), settings);

              // SEARCH
              case AppRoutes.search:
                return vibesterSlideRoute(const ExploreScreen(), settings);

              // SETTINGS
              case AppRoutes.settings:
                return vibesterSlideRoute(const SettingsScreen(), settings);
              case AppRoutes.personalInformationSettings:
                return vibesterSlideRoute(
                  const PersonalInformationSettingsScreen(),
                  settings,
                );

              // USER
              case AppRoutes.profile:
                return vibesterSlideRoute(const UserProfileScreen(), settings);
              case AppRoutes.profileEditing:
                return vibesterSlideRoute(
                  const ProfileEditingScreen(),
                  settings,
                );
              case AppRoutes.userInterests:
                // Edição avulsa, vinda das configurações: salva e volta.
                return vibesterSlideRoute(
                  const UserInterestsScreen(),
                  settings,
                );
              case AppRoutes.userInterestsSetup:
                // Mesma tela como passo do cadastro: sem seta de voltar, e ao
                // concluir segue para a apresentação descartando a pilha.
                return vibesterSlideRoute(
                  const UserInterestsScreen(noCadastro: true),
                  settings,
                );
              case AppRoutes.otherProfile:
                final accountid = settings.arguments as String;
                return vibesterSlideRoute(
                  OtherUsersProfileScreen(accountId: accountid),
                  settings,
                );

              // NOTIFICATIONS
              case AppRoutes.notifications:
                return vibesterSlideRoute(
                  const NotificationsScreen(),
                  settings,
                );

              // SAVED
              case AppRoutes.saved:
                return vibesterSlideRoute(const SavedScreen(), settings);

              // FEED
              case AppRoutes.feed:
                return vibesterSlideRoute(const FeedScreen(), settings);
              case AppRoutes.newPublication:
                return vibesterDetailRoute(
                  const NewPublicationScreen(),
                  settings,
                );
              case AppRoutes.postDetail:
                final highlight = settings.arguments as HighlightModel;
                return vibesterDetailRoute(
                  PostDetailScreen(highlight: highlight),
                  settings,
                );

              default:
                return null;
            }
          },
        ),
      ),
    );
  }
}