import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/safety/blocked_profile.dart';
import 'package:mobile/models/safety/report_reason.dart';
import 'package:mobile/providers/safety/block_provider.dart';
import 'package:mobile/service/safety/safety_service.dart';

class _FakeSafetyService extends SafetyService {
  final List<BlockedProfilesPage> pages;
  bool failNext = false;
  final List<String> blocked = [];
  final List<String> unblocked = [];
  int listCalls = 0;

  _FakeSafetyService({this.pages = const []});

  @override
  Future<BlockedProfilesPage> listBlocked({String? cursor, int limit = 50}) async {
    final page = pages[listCalls];
    listCalls++;
    return page;
  }

  @override
  Future<void> block(String accountId) async {
    if (failNext) {
      failNext = false;
      throw Exception('Não foi possível bloquear agora');
    }
    blocked.add(accountId);
  }

  @override
  Future<void> unblock(String accountId) async {
    if (failNext) {
      failNext = false;
      throw Exception('Não foi possível desbloquear agora');
    }
    unblocked.add(accountId);
  }

  @override
  Future<void> report({
    required ReportTargetType targetType,
    required String targetId,
    String? targetOwnerId,
    required ReportReason reason,
    String? details,
  }) async {}
}

void main() {
  test('load junta todas as páginas e só busca uma vez por conta', () async {
    final service = _FakeSafetyService(
      pages: const [
        BlockedProfilesPage(
          perfis: [BlockedProfile(accountId: 'a')],
          nextCursor: 'c1',
        ),
        BlockedProfilesPage(perfis: [BlockedProfile(accountId: 'b')]),
      ],
    );
    final provider = BlockProvider(service: service);

    await provider.load('me');
    await provider.load('me');

    expect(provider.isBlocked('a'), isTrue);
    expect(provider.isBlocked('b'), isTrue);
    expect(provider.isBlocked('c'), isFalse);
    expect(service.listCalls, 2);
  });

  test('block é otimista e desfaz quando a API recusa', () async {
    final service = _FakeSafetyService();
    final provider = BlockProvider(service: service);

    await provider.block('x');
    expect(provider.isBlocked('x'), isTrue);
    expect(service.blocked, ['x']);

    service.failNext = true;
    var notificacoes = 0;
    provider.addListener(() => notificacoes++);
    await expectLater(provider.block('y'), throwsException);
    expect(provider.isBlocked('y'), isFalse);
    expect(notificacoes, 2); // some e volta
  });

  test('unblock desfaz quando a API recusa', () async {
    final service = _FakeSafetyService();
    final provider = BlockProvider(service: service);
    await provider.block('x');

    service.failNext = true;
    await expectLater(provider.unblock('x'), throwsException);
    expect(provider.isBlocked('x'), isTrue);

    await provider.unblock('x');
    expect(provider.isBlocked('x'), isFalse);
  });

  test('clear esquece a lista e permite recarregar', () async {
    final service = _FakeSafetyService(
      pages: const [
        BlockedProfilesPage(perfis: [BlockedProfile(accountId: 'a')]),
        BlockedProfilesPage(perfis: []),
      ],
    );
    final provider = BlockProvider(service: service);

    await provider.load('me');
    provider.clear();
    expect(provider.isBlocked('a'), isFalse);

    await provider.load('me');
    expect(service.listCalls, 2);
  });
}
