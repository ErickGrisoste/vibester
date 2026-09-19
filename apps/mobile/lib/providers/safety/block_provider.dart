import 'package:flutter/material.dart';
import 'package:mobile/service/safety/safety_service.dart';

/// Perfis que o usuário logado bloqueou.
///
/// O backend já desfaz o follow ao bloquear (e o feed-service tira os posts do
/// feed), mas isso é assíncrono. Este conjunto esconde o conteúdo na hora, em
/// qualquer tela que liste gente ou publicação.
class BlockProvider extends ChangeNotifier {
  BlockProvider({SafetyService? service}) : _service = service ?? SafetyService();

  final SafetyService _service;
  final Set<String> _blockedIds = {};
  String? _loadedFor;

  /// Teto de ids trazidos no boot; bloqueio é raro, e acima disso a tela de
  /// contas bloqueadas pagina sozinha.
  static const _maxPreloaded = 1000;

  bool isBlocked(String? accountId) =>
      accountId != null && _blockedIds.contains(accountId);

  /// Carrega a lista uma vez por sessão (ou de novo com [force]).
  Future<void> load(String accountId, {bool force = false}) async {
    if (_loadedFor == accountId && !force) return;

    try {
      final ids = <String>{};
      String? cursor;
      do {
        final page = await _service.listBlocked(cursor: cursor, limit: 100);
        ids.addAll(page.perfis.map((p) => p.accountId));
        cursor = page.nextCursor;
      } while (cursor != null && ids.length < _maxPreloaded);

      _blockedIds
        ..clear()
        ..addAll(ids);
      _loadedFor = accountId;
      notifyListeners();
    } catch (e) {
      // Sem a lista o app continua usável; o backend segue impedindo o follow.
      debugPrint('BlockProvider: falha ao carregar bloqueios ($e)');
    }
  }

  /// Otimista: some da tela antes da resposta e volta se a API recusar.
  Future<void> block(String accountId) async {
    final added = _blockedIds.add(accountId);
    if (added) notifyListeners();
    try {
      await _service.block(accountId);
    } catch (_) {
      if (added) {
        _blockedIds.remove(accountId);
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> unblock(String accountId) async {
    final removed = _blockedIds.remove(accountId);
    if (removed) notifyListeners();
    try {
      await _service.unblock(accountId);
    } catch (_) {
      if (removed) {
        _blockedIds.add(accountId);
        notifyListeners();
      }
      rethrow;
    }
  }

  /// Logout, sessão expirada ou conta excluída.
  void clear() {
    _blockedIds.clear();
    _loadedFor = null;
    notifyListeners();
  }
}
