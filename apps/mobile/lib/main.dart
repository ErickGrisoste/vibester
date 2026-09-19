import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/auth_storage_service.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/notification/notification_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/providers/theme/theme_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/routes/route_observer.dart';
import 'package:mobile/service/interaction/interaction_tracker.dart';
import 'package:mobile/service/theme/theme_service.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/theme/vibester_page_route.dart';
import 'package:mobile/screens/events/event_detail_screen.dart';
import 'package:mobile/screens/events/event_list_screen.dart';
import 'package:mobile/screens/events/favorites_events_screen.dart';
import 'package:mobile/screens/feed/feed_screen.dart';
import 'package:mobile/screens/feed/new_publication_screen.dart';
import 'package:mobile/screens/home/home_screen.dart';
import 'package:mobile/screens/home/initial_screen.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mobile/screens/onboarding/onboarding_screen.dart';
import 'package:mobile/screens/places/favorite_places_screen.dart';
import 'package:mobile/screens/places/hot_places_screen.dart';
import 'package:mobile/screens/places/place_detail_screen.dart';
import 'package:mobile/screens/places/place_reviews_screen.dart';
import 'package:mobile/screens/register/email_confirm_screen.dart';
import 'package:mobile/screens/register/login_screen.dart';
import 'package:mobile/screens/register/recover_password_screen.dart';
import 'package:mobile/screens/register/register_screen.dart';
import 'package:mobile/screens/register/reset_password_screen.dart';
import 'package:mobile/screens/search/search_screen.dart';
import 'package:mobile/screens/settings/account_management_settings_screen.dart';
import 'package:mobile/screens/settings/personal_information_settings_screen.dart';
import 'package:mobile/screens/settings/settings_screen.dart';
import 'package:mobile/screens/user/other_users_profile_screen.dart';
import 'package:mobile/screens/user/profile_editing_screen.dart';
import 'package:mobile/screens/user/user_interests_screen.dart';
import 'package:mobile/screens/user/user_profile_screen.dart';
import 'package:mobile/widgets/cards/highlights/post_detail_screen.dart';
import 'package:provider/provider.dart';
import 'package:visibility_detector/visibility_detector.dart';

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

  // Aumenta o cache de imagens em memória do Flutter (padrão é só 100MB /
  // 1000 imagens). Com o padrão, abrir uma tela com fotos grandes (ex:
  // detalhe de post) evictava as miniaturas de outras telas (ex: grid do
  // perfil), fazendo elas "recarregarem" visualmente ao voltar.
  PaintingBinding.instance.imageCache.maximumSize = 300;
  PaintingBinding.instance.imageCache.maximumSizeBytes = 200 << 20; // 200MB

  // Resolução com que o VisibilityDetector reporta mudança de visibilidade.
  // O padrão de 500ms é grosso demais para a telemetria do feed: o
  // InteractionTracker separa "piscada de rolagem" (<300ms, descartada) de
  // "descarte rápido" (<1s, sinal negativo) de "foi visto" (≥1s), e com
  // meio segundo de granularidade esses três casos se confundem. 100ms custa
  // mais CPU, e é o preço de o dado de atenção significar alguma coisa.
  VisibilityDetectorController.instance.updateInterval = const Duration(
    milliseconds: 100,
  );

  await initializeDateFormatting('pt_BR', null);
  final savedUser = await AuthStorageService.loadSession();
  final onboardingPendente = await AuthStorageService.onboardingPendente();
  if (savedUser?.token != null) {
    ApiClient.token = savedUser!.token;
  }
  final initialThemeMode = await ThemeService.loadThemeMode();
  runApp(
    MyApp(
      savedUser: savedUser,
      onboardingPendente: onboardingPendente,
      initialThemeMode: initialThemeMode,
    ),
  );
}

class MyApp extends StatefulWidget {
  final UserModel? savedUser;
  final bool onboardingPendente;
  final ThemeMode initialThemeMode;

  const MyApp({
    super.key,
    this.savedUser,
    this.onboardingPendente = false,
    required this.initialThemeMode,
  });

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> {
  final GlobalKey<NavigatorState> _navigatorKey = GlobalKey<NavigatorState>();
  final AppLinks _appLinks = AppLinks();
  final UserService _userService = UserService();
  StreamSubscription<Uri>? _linkSubscription;

  // Vive no State, e não no build: o tracker guarda as impressões abertas e o
  // buffer de envio, e seria zerado a cada rebuild se fosse criado lá.
  final InteractionTracker _interactionTracker = InteractionTracker();
  AppLifecycleListener? _lifecycleListener;

  @override
  void initState() {
    super.initState();
    _initDeepLinks();

    // O fim da sessão é a parte mais valiosa do dado — é o que fez a pessoa
    // sair — e é exatamente o que se perde sem um envio ao ir para segundo
    // plano, porque o app pode nunca mais voltar.
    _lifecycleListener = AppLifecycleListener(
      onPause: _interactionTracker.onAppPaused,
      onResume: _interactionTracker.onAppResumed,
    );
  }

  Future<void> _initDeepLinks() async {
    final initialUri = await _appLinks.getInitialLink();
    if (initialUri != null) _handleUri(initialUri);

    _linkSubscription = _appLinks.uriLinkStream.listen(_handleUri);
  }

  // Espera vibester://profile/{token}, gerado por
  // UserService.generateShareLink no backend.
  Future<void> _handleUri(Uri uri) async {
    if (uri.scheme != 'vibester' || uri.host != 'profile') return;
    final token = uri.pathSegments.isNotEmpty ? uri.pathSegments.first : null;
    if (token == null) return;

    final navigator = _navigatorKey.currentState;
    if (navigator == null) return;

    try {
      final resolvedAccountId = await _userService.resolveShareToken(token);
      if (resolvedAccountId == null) {
        ScaffoldMessenger.of(navigator.context).showSnackBar(
          const SnackBar(
            content: Text(
              'Este link de compartilhamento expirou ou é inválido.',
            ),
          ),
        );
        return;
      }

      final currentUserId = navigator.context
          .read<UserProvider>()
          .user
          ?.accountId;
      if (resolvedAccountId == currentUserId) {
        navigator.pushNamed(AppRoutes.profile);
      } else {
        navigator.pushNamed(
          AppRoutes.otherProfile,
          arguments: resolvedAccountId,
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(
        navigator.context,
      ).showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }

  @override
  void dispose() {
    _linkSubscription?.cancel();
    _lifecycleListener?.dispose();
    _interactionTracker.dispose();
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
        ChangeNotifierProvider(create: (_) => EventsListProvider()),
        ChangeNotifierProvider(create: (_) => PublicationListProvider()),
        ChangeNotifierProvider.value(value: userProvider),
        ChangeNotifierProvider.value(value: notificationProvider),
        ChangeNotifierProvider.value(value: themeProvider),
        // Provider simples, não ChangeNotifier: telemetria nunca redesenha tela.
        Provider<InteractionTracker>.value(value: _interactionTracker),
      ],
      child: Consumer<ThemeProvider>(
        builder: (context, themeProvider, _) => MaterialApp(
          navigatorKey: _navigatorKey,
          navigatorObservers: [appRouteObserver],
          debugShowCheckedModeBanner: false,
          //Chama a classe da propriedade de scroll
          scrollBehavior: _NoBounceScrollBehavior(),
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: themeProvider.themeMode,
          // Sessao salva com onboarding pendente = o app foi fechado no meio
          // do onboarding; retoma dali em vez de pular direto para a home.
          initialRoute: widget.savedUser == null
              ? AppRoutes.initialScreen
              : (widget.onboardingPendente
                    ? AppRoutes.onboarding
                    : AppRoutes.home),
          onGenerateRoute: (settings) {
            switch (settings.name) {
              // EVENTS
              case AppRoutes.eventList:
                return vibesterSlideRoute(const EventListScreen(), settings);
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
              case AppRoutes.placeReviews:
                final place = settings.arguments as PlaceModel;
                return vibesterDetailRoute(
                  PlaceReviewsScreen(place: place),
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
                return vibesterSlideRoute(const SearchScreen(), settings);

              // SETTINGS
              case AppRoutes.accountManagementSettings:
                return vibesterSlideRoute(
                  const AccountManagementSettingsScreen(),
                  settings,
                );
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
                return vibesterSlideRoute(
                  const UserInterestsScreen(),
                  settings,
                );
              case AppRoutes.otherProfile:
                final accountid = settings.arguments as String;
                return vibesterSlideRoute(
                  OtherUsersProfileScreen(accountId: accountid),
                  settings,
                );

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
