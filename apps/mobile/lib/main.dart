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
import 'package:mobile/service/theme/theme_service.dart';
import 'package:mobile/theme/app_theme.dart';
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

PageRouteBuilder _slideRoute(Widget page, RouteSettings settings) {
  return PageRouteBuilder(
    settings: settings,
    pageBuilder: (_, __, ___) => page,
    transitionsBuilder: (_, animation, __, child) => SlideTransition(
      position: Tween<Offset>(
        begin: const Offset(1, 0),
        end: Offset.zero,
      ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut)),
      child: child,
    ),
  );
}

PageRouteBuilder _fadeRoute(Widget page, RouteSettings settings) {
  return PageRouteBuilder(
    settings: settings,
    pageBuilder: (_, __, ___) => page,
    transitionsBuilder: (_, animation, __, child) =>
        FadeTransition(opacity: animation, child: child),
  );
}

PageRouteBuilder _scaleRoute(Widget page, RouteSettings settings) {
  return PageRouteBuilder(
    settings: settings,
    pageBuilder: (_, __, ___) => page,
    transitionsBuilder: (_, animation, __, child) => ScaleTransition(
      scale: Tween<double>(
        begin: 0.9,
        end: 1.0,
      ).animate(CurvedAnimation(parent: animation, curve: Curves.easeOut)),
      child: FadeTransition(opacity: animation, child: child),
    ),
  );
}

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

  @override
  void initState() {
    super.initState();
    _initDeepLinks();
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
                return _slideRoute(const EventListScreen(), settings);
              case AppRoutes.favoritesEvents:
                return _slideRoute(const FavoritesEventsScreen(), settings);
              case AppRoutes.eventDetail:
                final event = settings.arguments as EventModel;
                return _scaleRoute(
                  EventDetailScreen(eventModel: event),
                  settings,
                );

              // PLACES
              case AppRoutes.favoritesPlaces:
                return _slideRoute(const FavoritePlacesScreen(), settings);
              case AppRoutes.hotPlaces:
                return _slideRoute(const HotPlacesScreen(), settings);
              case AppRoutes.placeDetail:
                final placeId = settings.arguments as String;
                return _scaleRoute(
                  PlaceDetailScreen(placeId: placeId),
                  settings,
                );
              case AppRoutes.placeReviews:
                final place = settings.arguments as PlaceModel;
                return _scaleRoute(PlaceReviewsScreen(place: place), settings);

              // HOME
              case AppRoutes.home:
                return _fadeRoute(const HomeScreen(), settings);
              case AppRoutes.initialScreen:
                return _fadeRoute(const InitialScreen(), settings);

              // ONBOARDING
              case AppRoutes.onboarding:
                return _fadeRoute(const OnboardingScreen(), settings);

              // REGISTER
              case AppRoutes.emailConfirm:
                final args = settings.arguments as Map<String, String>;
                return _fadeRoute(
                  EmailConfirmScreen(
                    email: args['email']!,
                    senha: args['senha']!,
                  ),
                  settings,
                );
              case AppRoutes.login:
                return _fadeRoute(const LoginScreen(), settings);
              case AppRoutes.recoverPassword:
                return _fadeRoute(const RecoverPasswordScreen(), settings);
              case AppRoutes.register:
                return _fadeRoute(const RegisterScreen(), settings);
              case AppRoutes.resetPassword:
                return _fadeRoute(const ResetPasswordScreen(), settings);

              // SEARCH
              case AppRoutes.search:
                return _slideRoute(const SearchScreen(), settings);

              // SETTINGS
              case AppRoutes.accountManagementSettings:
                return _slideRoute(
                  const AccountManagementSettingsScreen(),
                  settings,
                );
              case AppRoutes.settings:
                return _slideRoute(const SettingsScreen(), settings);
              case AppRoutes.personalInformationSettings:
                return _slideRoute(
                  const PersonalInformationSettingsScreen(),
                  settings,
                );

              // USER
              case AppRoutes.profile:
                return _slideRoute(const UserProfileScreen(), settings);
              case AppRoutes.profileEditing:
                return _slideRoute(const ProfileEditingScreen(), settings);
              case AppRoutes.userInterests:
                return _slideRoute(const UserInterestsScreen(), settings);
              case AppRoutes.otherProfile:
                final accountid = settings.arguments as String;
                return _slideRoute(
                  OtherUsersProfileScreen(accountId: accountid),
                  settings,
                );

              // FEED
              case AppRoutes.feed:
                return _slideRoute(const FeedScreen(), settings);
              case AppRoutes.newPublication:
                return _scaleRoute(const NewPublicationScreen(), settings);
              case AppRoutes.postDetail:
                final highlight = settings.arguments as HighlightModel;
                return _scaleRoute(
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