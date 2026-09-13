import 'dart:math';

import 'package:flutter/material.dart';
import 'package:mobile/models/feed/feed_item_model.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/service/feed/feed_service.dart';
import 'package:mobile/service/posts/post_service.dart';
import 'package:mobile/utils/data_freshness.dart';

class PublicationListProvider extends ChangeNotifier {
  final FeedService _feedService = FeedService();
  final PostService _postService = PostService();

  final List<PublicationModel> _publications = [];
  String? _nextCursor;
  String? _userId;
  DateTime? _lastFetchedAt;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  String? _erro;

  List<PublicationModel> get publications => _publications;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get hasMore => _hasMore;
  String? get erro => _erro;

  /// Ver [PlaceListProvider.fetchPlaces] para a lógica de staleness. Aqui
  /// também considera troca de usuário como motivo para refazer a busca.
  Future<void> fetchPublications(String userId, {bool force = false}) async {
    final sameUser = _userId == userId;
    if (sameUser &&
        _publications.isNotEmpty &&
        !force &&
        !isDataStale(_lastFetchedAt)) {
      return;
    }

    _userId = userId;
    _isLoading = true;
    _erro = null;
    _publications.clear();
    _nextCursor = null;
    _hasMore = true;
    notifyListeners();

    try {
      final page = await _feedService.getFeed(userId: userId);
      _aplicarPagina(page);
      _lastFetchedAt = DateTime.now();
    } catch (e) {
      _erro = 'Não foi possível carregar o feed';
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadMore() async {
    if (_isLoadingMore || !_hasMore || _userId == null) return;

    _isLoadingMore = true;
    notifyListeners();

    try {
      final page = await _feedService.getFeed(
        userId: _userId!,
        cursor: _nextCursor,
      );
      _aplicarPagina(page);
    } catch (_) {
      // mantém a lista atual se der erro ao carregar mais
    } finally {
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  void _aplicarPagina(FeedPage page) {
    final posts = page.items
        .where((item) => item.itemType == FeedItemType.userPost)
        .map((item) => PublicationModel.fromFeedItem(item))
        .toList();

    _publications.addAll(posts);
    _nextCursor = page.nextCursor;
    _hasMore = page.nextCursor != null && page.items.isNotEmpty;
  }

  void addPublication(PublicationModel publication) {
    _publications.insert(0, publication);
    notifyListeners();
  }

  /// Exclusão otimista: tira a publicação da lista antes da resposta e a
  /// devolve à mesma posição se a API recusar. Funciona também para post que
  /// não está no feed (aberto pela grade do perfil) — aí só chama a API.
  /// Relança o erro para a tela avisar o usuário.
  Future<void> deletePublication(String id, String userId) async {
    final index = _publications.indexWhere((p) => p.id == id);
    final removed = index == -1 ? null : _publications.removeAt(index);
    if (removed != null) notifyListeners();

    try {
      await _postService.deletePost(postId: id, userId: userId);
    } catch (e) {
      if (removed != null) {
        _publications.insert(min(index, _publications.length), removed);
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> toggleLike(String? id, String? userId) async {
    if (id == null || userId == null) return;

    final index = _publications.indexWhere((p) => p.id == id);
    if (index == -1) return;

    final pub = _publications[index];
    final wasLiked = pub.isLiked;

    _publications[index] = pub.copyWith(
      isLiked: !wasLiked,
      likes: wasLiked ? max(0, pub.likes - 1) : pub.likes + 1,
    );
    notifyListeners();

    try {
      if (wasLiked) {
        await _postService.unlikePost(postId: id, userId: userId);
      } else {
        await _postService.likePost(postId: id, userId: userId);
      }
    } catch (e) {
      final is409 =
          e.toString().contains('409') ||
          e.toString().contains('already liked') ||
          e.toString().contains('already unliked');
      if (!is409) {
        // Sem este log a falha era invisível: a UI só voltava ao estado
        // anterior e parecia que o toque nem tinha chamado a API.
        debugPrint('toggleLike falhou para o post $id: $e');
        _publications[index] = pub;
        notifyListeners();
      }
    }
  }
}
