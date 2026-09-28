import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/screens/events/event_detail_screen.dart';
import 'package:mobile/screens/events/event_list_screen.dart';
import 'package:mobile/screens/events/favorites_events_screen.dart';
import 'package:mobile/screens/explore/explore_screen.dart';
import 'package:mobile/screens/feed/feed_screen.dart';
import 'package:mobile/screens/feed/new_publication_screen.dart';
import 'package:mobile/screens/home/home_screen.dart';
import 'package:mobile/screens/home/initial_screen.dart';
import 'package:mobile/screens/home/today_screen.dart';
import 'package:mobile/screens/notification/notifications_screen.dart';
import 'package:mobile/screens/onboarding/onboarding_screen.dart';
import 'package:mobile/screens/places/favorite_places_screen.dart';
import 'package:mobile/screens/places/hot_places_screen.dart';
import 'package:mobile/screens/places/place_ambience_gallery_screen.dart';
import 'package:mobile/screens/places/place_detail_screen.dart';
import 'package:mobile/screens/register/email_confirm_screen.dart';
import 'package:mobile/screens/register/login_screen.dart';
import 'package:mobile/screens/register/recover_password_screen.dart';
import 'package:mobile/screens/register/register_screen.dart';
import 'package:mobile/screens/register/reset_password_screen.dart';
import 'package:mobile/screens/saved/saved_screen.dart';
import 'package:mobile/screens/settings/blocked_accounts_screen.dart';
import 'package:mobile/screens/settings/delete_account_screen.dart';
import 'package:mobile/screens/settings/personal_information_settings_screen.dart';
import 'package:mobile/screens/settings/settings_screen.dart';
import 'package:mobile/screens/user/follow_list_screen.dart';
import 'package:mobile/screens/user/other_users_profile_screen.dart';
import 'package:mobile/screens/user/profile_editing_screen.dart';
import 'package:mobile/screens/user/user_interests_screen.dart';
import 'package:mobile/screens/user/user_profile_screen.dart';
import 'package:mobile/widgets/cards/highlights/post_detail_screen.dart';

import '../helpers/pump_app.dart';

/// Bateria de renderização: monta **toda** tela do app em três larguras.
///
/// Em modo debug o Flutter reporta estouro de layout (`RenderFlex
/// overflowed`), restrição inválida e qualquer exceção de build como erro do
/// framework, e o `testWidgets` reprova quando isso acontece. Ou seja: este
/// arquivo é o QA visual do briefing (§106/§107) automatizado — se uma tela
/// quebrar em tela pequena, o teste acusa antes do aparelho.
///
/// Sem rede no ambiente de teste, as chamadas de API falham rápido e os
/// providers caem nos estados tratados (erro/vazio) — que é exatamente o
/// caminho que mais quebrava antes, e o que queremos ver renderizando.
void main() {
  setUpAll(setUpTestEnvironment);

  final evento = EventModel(
    id: 'evt-1',
    placeId: 'place-1',
    dataDoEvento: DateTime.now().add(const Duration(hours: 4)),
    titulo: 'Festival Subsolo',
    categoria: 'Balada',
    localizacao: 'Maringá',
    informacoes: 'Line-up com três palcos e discotecagem até as 6h.',
    artistas: 'DJ Fulana, DJ Beltrano',
    totalConfirmed: 42,
    ticketLink: 'https://exemplo.com/ingresso',
    organizador: 'Coletivo Subsolo',
  );

  final destaque = HighlightModel(
    postId: 'post-1',
    userId: 'account-1',
    imagensUrls: const [],
    legenda: 'Noite boa demais.',
    totalCurtidas: 12,
    totalComentarios: 3,
    foiDeletado: false,
    criadoEm: DateTime.now().toIso8601String(),
    atualizadoEm: DateTime.now().toIso8601String(),
  );

  /// Telas que não dependem de argumento nem de sessão.
  final telasSimples = <String, Widget Function()>{
    'InitialScreen': () => const InitialScreen(),
    'LoginScreen': () => const LoginScreen(),
    'RegisterScreen': () => const RegisterScreen(),
    'RecoverPasswordScreen': () => const RecoverPasswordScreen(),
    'ResetPasswordScreen': () =>
        const ResetPasswordScreen(email: 'ana@example.com'),
    'BlockedAccountsScreen': () => const BlockedAccountsScreen(),
    'DeleteAccountScreen': () => const DeleteAccountScreen(),
    'OnboardingScreen': () => const OnboardingScreen(),
    'HomeScreen (casca + dock)': () => const HomeScreen(),
    'TodayScreen': () => const TodayScreen(),
    'ExploreScreen': () => const ExploreScreen(),
    'FeedScreen': () => const FeedScreen(),
    'SavedScreen': () => const SavedScreen(),
    'NotificationsScreen': () => const NotificationsScreen(),
    'EventListScreen': () => const EventListScreen(showHeader: true),
    'FavoritesEventsScreen': () => const FavoritesEventsScreen(),
    'FavoritePlacesScreen': () => const FavoritePlacesScreen(),
    'HotPlacesScreen': () => const HotPlacesScreen(),
    'SettingsScreen': () => const SettingsScreen(),
    'UserInterestsScreen': () => const UserInterestsScreen(),
    'NewPublicationScreen': () => const NewPublicationScreen(),
  };

  for (final entry in telasSimples.entries) {
    group(entry.key, () {
      for (final tela in TestScreens.all.entries) {
        testWidgets('renderiza em tela ${tela.key}', (tester) async {
          await pumpScreen(
            tester,
            entry.value(),
            size: tela.value,
            user: fakeUser(),
          );
          expect(tester.takeException(), isNull);
        });
      }
    });
  }

  group('telas com argumento', () {
    testWidgets('RegisterScreen pede só o nome de usuário, sem @', (
      tester,
    ) async {
      await pumpScreen(tester, const RegisterScreen());

      // Não existe mais campo de nome: o primeiro campo é o de usuário.
      expect(find.text('NOME'), findsNothing);
      expect(find.text('NOME DE USUÁRIO'), findsOneWidget);

      final campos = find.byType(EditableText);
      await tester.enterText(campos.at(0), '@João Côrtes');
      await tester.pump();

      // O @ digitado some, o texto sai minúsculo e sem acento, e a prévia
      // mostra o @ que o app coloca.
      expect(find.text('joao cortes'), findsOneWidget);
      expect(find.text('SEU USUÁRIO VAI SER  @joaocortes'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('EventDetailScreen renderiza o evento', (tester) async {
      await pumpScreen(
        tester,
        EventDetailScreen(eventModel: evento),
        user: fakeUser(),
      );

      expect(find.text('Festival Subsolo'), findsOneWidget);
      // Prova social real: o número vem do model, não é inventado na tela.
      expect(find.text('42'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('EventDetailScreen aguenta tela pequena', (tester) async {
      await pumpScreen(
        tester,
        EventDetailScreen(eventModel: evento),
        size: TestScreens.small,
        user: fakeUser(),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('PlaceDetailScreen mostra estado de erro sem rede', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const PlaceDetailScreen(placeId: 'place-1'),
        user: fakeUser(),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('EventListScreen com placeId busca por estabelecimento', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const EventListScreen(placeId: 'place-1'),
        user: fakeUser(),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('FollowListScreen sem rede cai no estado de erro tratado', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const FollowListScreen(
          accountId: 'account-1',
          nome: 'Ana Vibes',
          totalSeguidores: 128,
          totalSeguindo: 90,
        ),
        size: TestScreens.small,
        user: fakeUser(),
      );
      expect(find.text('SEGUIDORES'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('PlaceAmbienceGalleryScreen renderiza sem quebrar', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const PlaceAmbienceGalleryScreen(
          photos: [
            'https://cdn.test/ambiente-1.jpg',
            'https://cdn.test/ambiente-2.jpg',
          ],
          placeName: 'Bar do Zé',
        ),
        user: fakeUser(),
      );
      expect(find.text('Bar do Zé'), findsOneWidget);
      expect(find.text('1 DE 2'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('PlaceAmbienceGalleryScreen sem fotos mostra estado vazio', (
      tester,
    ) async {
      await pumpScreen(
        tester,
        const PlaceAmbienceGalleryScreen(photos: [], placeName: 'Bar do Zé'),
        size: TestScreens.small,
        user: fakeUser(),
      );
      expect(find.text('SEM FOTOS'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('PostDetailScreen renderiza', (tester) async {
      await pumpScreen(
        tester,
        PostDetailScreen(posts: [destaque]),
        user: fakeUser(),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('PostDetailScreen abre no post tocado, com os outros', (
      tester,
    ) async {
      // Três posts da conta logada; o do meio é o tocado na grade.
      HighlightModel post(String id, String legenda) => HighlightModel(
        postId: id,
        userId: destaque.userId,
        imagensUrls: const [],
        legenda: legenda,
        totalCurtidas: 0,
        totalComentarios: 0,
        foiDeletado: false,
        criadoEm: DateTime.now().toIso8601String(),
        atualizadoEm: DateTime.now().toIso8601String(),
      );

      await pumpScreen(
        tester,
        PostDetailScreen(
          posts: [
            post('post-a', 'Primeiro post'),
            post('post-b', 'Post tocado'),
            post('post-c', 'Terceiro post'),
          ],
          initialIndex: 1,
        ),
        user: fakeUser(),
      );

      // Todos os posts são da conta logada: o título é "Meus Posts".
      expect(find.text('Meus Posts'), findsOneWidget);
      expect(find.text('Post tocado'), findsOneWidget);
      // Um voltar só, no cabeçalho — não um por post.
      expect(find.bySemanticsLabel('Voltar'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('OtherUsersProfileScreen renderiza', (tester) async {
      await pumpScreen(
        tester,
        const OtherUsersProfileScreen(accountId: 'outro-1'),
        user: fakeUser(),
      );
      expect(tester.takeException(), isNull);
    });

    testWidgets('EmailConfirmScreen renderiza', (tester) async {
      await pumpScreen(
        tester,
        const EmailConfirmScreen(email: 'ana@example.com', senha: 'secreta12'),
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('telas de perfil com e sem sessão', () {
    testWidgets('UserProfileScreen mostra esqueleto sem usuário', (
      tester,
    ) async {
      await pumpScreen(tester, const UserProfileScreen());
      expect(tester.takeException(), isNull);
    });

    testWidgets('UserProfileScreen mostra a identidade com usuário', (
      tester,
    ) async {
      await pumpScreen(tester, const UserProfileScreen(), user: fakeUser());

      expect(find.text('Ana Vibes'), findsOneWidget);
      expect(find.text('@@anavibes'), findsNothing); // não duplica o @
      expect(find.text('Seus rolês'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('ProfileEditingScreen renderiza', (tester) async {
      await pumpScreen(tester, const ProfileEditingScreen(), user: fakeUser());
      expect(tester.takeException(), isNull);
    });

    testWidgets(
      'PersonalInformationSettingsScreen separa editável de leitura',
      (tester) async {
        await pumpScreen(
          tester,
          const PersonalInformationSettingsScreen(),
          user: fakeUser(),
        );

        // Campos com API por trás.
        expect(find.text('Nome'), findsOneWidget);
        expect(find.text('Bio'), findsOneWidget);

        // Campos sem API ficam mais abaixo; o ListView não constrói o que
        // está fora da tela, então é preciso rolar até eles.
        await tester.scrollUntilVisible(
          find.textContaining('ainda não podem ser alterados'),
          200,
          scrollable: find.byType(Scrollable).first,
        );

        expect(find.text('E-mail'), findsOneWidget);
        expect(
          find.textContaining('ainda não podem ser alterados'),
          findsOneWidget,
        );
        expect(tester.takeException(), isNull);
      },
    );
  });

  group('tema claro', () {
    // O app tem os dois temas; a bateria acima roda no escuro, então aqui
    // conferimos que o claro também monta (cores derivadas mudam de valor).
    for (final entry in {
      'TodayScreen': const TodayScreen(),
      'ExploreScreen': const ExploreScreen(),
      'SettingsScreen': const SettingsScreen(),
      'InitialScreen': const InitialScreen(),
    }.entries) {
      testWidgets('${entry.key} renderiza no tema claro', (tester) async {
        await pumpScreen(
          tester,
          entry.value,
          user: fakeUser(),
          themeMode: ThemeMode.light,
        );
        expect(tester.takeException(), isNull);
      });
    }
  });
}
