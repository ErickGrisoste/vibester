import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/safety/blocked_profile.dart';
import 'package:mobile/models/user/follow_profile.dart';
import 'package:mobile/providers/safety/block_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/screens/user/follow_list_screen.dart';
import 'package:mobile/screens/user/user_profile_screen.dart';
import 'package:mobile/service/safety/safety_service.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/widgets/cards/users/user_row.dart';
import 'package:mobile/widgets/common/vibester_state.dart';

import '../helpers/pump_app.dart';

class _FakeUserService extends UserService {
  _FakeUserService({
    this.seguidores = const [],
    this.seguindo = const [],
    this.erro,
    this.nextCursor,
  });

  final List<FollowProfile> seguidores;
  final List<FollowProfile> seguindo;
  final String? erro;
  final String? nextCursor;

  /// Cada chamada registrada como `<lista>:<cursor>` — é o que prova que a
  /// aba não visitada não busca nada e que a paginação usa o cursor.
  final List<String> chamadas = [];

  @override
  Future<FollowProfilesPage> listFollowers(
    String accountId, {
    String? cursor,
    int limit = 30,
  }) async {
    chamadas.add('followers:$cursor');
    if (erro != null) throw Exception(erro);
    return FollowProfilesPage(
      perfis: cursor == null ? seguidores : const [],
      nextCursor: cursor == null ? nextCursor : null,
    );
  }

  @override
  Future<FollowProfilesPage> listFollowing(
    String accountId, {
    String? cursor,
    int limit = 30,
  }) async {
    chamadas.add('following:$cursor');
    if (erro != null) throw Exception(erro);
    return FollowProfilesPage(perfis: seguindo);
  }
}

class _FakeSafetyService extends SafetyService {
  _FakeSafetyService(this.bloqueados);

  final List<String> bloqueados;

  @override
  Future<BlockedProfilesPage> listBlocked({String? cursor, int limit = 50}) async =>
      BlockedProfilesPage(
        perfis: [for (final id in bloqueados) BlockedProfile(accountId: id)],
      );
}

FollowProfile _perfil(String id, String nome, {int seguidores = 0}) =>
    FollowProfile(
      accountId: id,
      nome: nome,
      nomeUsuario: nome.toLowerCase(),
      seguidores: seguidores,
      seguidoEm: DateTime(2026, 3, 1),
    );

void main() {
  setUpAll(setUpTestEnvironment);

  testWidgets('abre no lado que foi tocado e lista quem segue o perfil', (
    tester,
  ) async {
    final service = _FakeUserService(
      seguidores: [
        _perfil('conta-2', 'Bia', seguidores: 12),
        _perfil('conta-3', 'Caio'),
      ],
    );

    await pumpScreen(
      tester,
      FollowListScreen(
        accountId: 'account-1',
        nome: 'Ana Vibes',
        totalSeguidores: 2,
        totalSeguindo: 5,
        service: service,
      ),
      user: fakeUser(),
    );

    expect(find.text('Ana Vibes'), findsOneWidget);
    expect(find.text('Bia'), findsOneWidget);
    expect(find.text('Caio'), findsOneWidget);
    // Perfil já hidratado pela API: o contador da pessoa vem junto da lista.
    expect(find.textContaining('@bia'), findsOneWidget);
    expect(find.textContaining('12 SEGUINDO ELE'), findsOneWidget);
    // A outra aba não gastou requisição.
    expect(service.chamadas, ['followers:null']);
    expect(tester.takeException(), isNull);
  });

  testWidgets('alterna para SEGUINDO, busca a outra lista e não refaz a '
      'busca ao voltar', (tester) async {
    final service = _FakeUserService(
      seguidores: [_perfil('conta-2', 'Bia')],
      seguindo: [_perfil('conta-9', 'Duda')],
    );

    await pumpScreen(
      tester,
      FollowListScreen(accountId: 'account-1', service: service),
      user: fakeUser(),
    );

    await tester.tap(find.text('SEGUINDO'));
    await tester.pumpAndSettle();

    expect(find.text('Duda'), findsOneWidget);
    expect(service.chamadas, ['followers:null', 'following:null']);

    await tester.tap(find.text('SEGUIDORES'));
    await tester.pumpAndSettle();

    expect(find.text('Bia'), findsOneWidget);
    expect(service.chamadas, ['followers:null', 'following:null']);
  });

  testWidgets('tocar numa pessoa abre o perfil dela', (tester) async {
    Object? argumentos;
    String? rota;

    await pumpScreen(
      tester,
      FollowListScreen(
        accountId: 'account-1',
        service: _FakeUserService(seguidores: [_perfil('conta-2', 'Bia')]),
      ),
      user: fakeUser(),
      onGenerateRoute: (settings) {
        rota = settings.name;
        argumentos = settings.arguments;
        return MaterialPageRoute(builder: (_) => const SizedBox.shrink());
      },
    );

    await tester.tap(find.byType(UserRow));
    await tester.pumpAndSettle();

    expect(rota, AppRoutes.otherProfile);
    expect(argumentos, 'conta-2');
  });

  testWidgets('esconde quem o usuário bloqueou', (tester) async {
    final blocks = BlockProvider(service: _FakeSafetyService(['conta-3']));
    await blocks.load('account-1');

    await pumpScreen(
      tester,
      FollowListScreen(
        accountId: 'account-1',
        service: _FakeUserService(
          seguidores: [_perfil('conta-2', 'Bia'), _perfil('conta-3', 'Caio')],
        ),
      ),
      user: fakeUser(),
      blocks: blocks,
    );

    expect(find.text('Bia'), findsOneWidget);
    expect(find.text('Caio'), findsNothing);
  });

  testWidgets('rola até o fim e pede a próxima página pelo cursor', (
    tester,
  ) async {
    const cursor = '2026-03-01T00:00:00.000Z';
    final service = _FakeUserService(
      seguidores: [
        for (var i = 0; i < 30; i++) _perfil('conta-$i', 'Pessoa $i'),
      ],
      nextCursor: cursor,
    );

    await pumpScreen(
      tester,
      FollowListScreen(accountId: 'account-1', service: service),
      user: fakeUser(),
    );

    expect(service.chamadas, ['followers:null']);

    await tester.drag(find.byType(UserRow).first, const Offset(0, -2000));
    await tester.pumpAndSettle();

    expect(service.chamadas, ['followers:null', 'followers:$cursor']);
  });

  testWidgets('lista vazia explica o que fazer, sem inventar gente', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      FollowListScreen(accountId: 'account-1', service: _FakeUserService()),
      user: fakeUser(),
    );

    expect(find.text('NINGUÉM AQUI'), findsOneWidget);
    expect(find.byType(UserRow), findsNothing);
  });

  testWidgets('erro da API vira mensagem tratada com "tentar de novo"', (
    tester,
  ) async {
    await pumpScreen(
      tester,
      FollowListScreen(
        accountId: 'account-1',
        service: _FakeUserService(erro: 'Erro ao carregar seguidores'),
      ),
      user: fakeUser(),
    );

    expect(find.byType(VibesterState), findsOneWidget);
    expect(find.text('Erro ao carregar seguidores'), findsOneWidget);
    expect(find.text('Tentar de novo'), findsOneWidget);
    // Nada de "Exception:" vazando para a tela.
    expect(find.textContaining('Exception'), findsNothing);
  });

  testWidgets('aguenta as três larguras nos dois temas', (tester) async {
    for (final tema in ThemeMode.values.where((m) => m != ThemeMode.system)) {
      for (final tamanho in TestScreens.all.values) {
        await pumpScreen(
          tester,
          FollowListScreen(
            accountId: 'account-1',
            nome: 'Ana Vibes',
            totalSeguidores: 128,
            totalSeguindo: 90,
            service: _FakeUserService(
              seguidores: [_perfil('conta-2', 'Bia', seguidores: 12)],
            ),
          ),
          size: tamanho,
          themeMode: tema,
          user: fakeUser(),
        );
        expect(tester.takeException(), isNull);
      }
    }
  });

  testWidgets('contadores do próprio perfil abrem a listagem no lado tocado', (
    tester,
  ) async {
    Object? argumentos;
    String? rota;

    await pumpScreen(
      tester,
      const UserProfileScreen(),
      user: fakeUser(),
      onGenerateRoute: (settings) {
        rota = settings.name;
        argumentos = settings.arguments;
        return MaterialPageRoute(builder: (_) => const SizedBox.shrink());
      },
    );

    await tester.tap(find.text('SEGUINDO'));
    await tester.pumpAndSettle();

    expect(rota, AppRoutes.followList);
    final args = argumentos as FollowListArgs;
    expect(args.tab, FollowTab.seguindo);
    expect(args.accountId, 'account-1');
    // Os totais do chip vêm do perfil que o usuário acabou de ver.
    expect(args.totalSeguidores, 128);
    expect(args.totalSeguindo, 90);
  });
}
