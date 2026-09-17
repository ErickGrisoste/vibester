import 'dart:math';

import 'package:flutter/material.dart';
import 'package:mobile/models/feed/feed_item_model.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/service/feed/feed_service.dart';
import 'package:mobile/service/posts/post_service.dart';
import 'package:mobile/utils/data_freshness.dart';

/// Uma carga do feed já reduzida ao que o feed desenha: post de usuário.
class _Carga {
  const _Carga({required this.posts, required this.nextCursor});

  final List<PublicationModel> posts;
  final String? nextCursor;
}

class PublicationListProvider extends ChangeNotifier {
  PublicationListProvider({FeedService? feedService, PostService? postService})
    : _feedService = feedService ?? FeedService(),
      _postService = postService ?? PostService();

  final FeedService _feedService;
  final PostService _postService;

  final List<PublicationModel> _publications = [];
  String? _nextCursor;
  String? _userId;
  DateTime? _lastFetchedAt;
  bool _isLoading = false;
  bool _isLoadingMore = false;
  bool _hasMore = true;
  String? _erro;
  String? _erroAoCarregarMais;

  /// Páginas seguidas que o provider percorre atrás de post de usuário antes
  /// de devolver o controle.
  ///
  /// O feed-service devolve tipos misturados e o cartão só existe para
  /// `userPost`, então uma página inteira pode não render nada. Quando isso
  /// acontecia a lista não crescia, o scroll não se movia e `loadMore` — que
  /// só dispara em evento de scroll — nunca era chamado de novo: o feed
  /// truncava sozinho no meio, com cursor ainda aberto.
  static const _maxPaginasSemPost = 5;

  List<PublicationModel> get publications => _publications;
  bool get isLoading => _isLoading;
  bool get isLoadingMore => _isLoadingMore;
  bool get hasMore => _hasMore;
  String? get erro => _erro;

  /// Erro da paginação, separado de [erro]: aqui a lista atual continua de pé
  /// e a tela só oferece "Tentar de novo" no fim do scroll.
  String? get erroAoCarregarMais => _erroAoCarregarMais;

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

    // Só a troca de usuário esvazia a lista na hora — o feed anterior é de
    // outra sessão e não pode aparecer nem por um quadro. No pull-to-refresh
    // a lista atual fica na tela até a nova chegar: limpar antes do request
    // trocava o feed inteiro pelo esqueleto a cada refresh, e devolvia o
    // usuário para o topo mesmo quando nada tinha mudado.
    if (!sameUser) {
      _publications.clear();
      _nextCursor = null;
      _hasMore = true;
    }

    _userId = userId;
    _isLoading = true;
    _erro = null;
    _erroAoCarregarMais = null;
    notifyListeners();

    try {
      final carga = await _carregar(userId);
      _publications
        ..clear()
        ..addAll(carga.posts);
      _nextCursor = carga.nextCursor;
      _hasMore = carga.nextCursor != null;
      _lastFetchedAt = DateTime.now();
    } catch (e) {
      debugPrint('Falha ao carregar o feed de $userId: $e');
      _erro = _mensagem(e, 'Não foi possível carregar o feed');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<void> loadMore() async {
    if (_isLoadingMore || !_hasMore || _userId == null) return;

    _isLoadingMore = true;
    _erroAoCarregarMais = null;
    notifyListeners();

    try {
      final carga = await _carregar(_userId!, cursor: _nextCursor);
      _publications.addAll(carga.posts);
      _nextCursor = carga.nextCursor;
      _hasMore = carga.nextCursor != null;
    } catch (e) {
      // A lista atual fica de pé e o erro vira uma linha com "Tentar de novo"
      // no fim do scroll. Antes isso sumia em silêncio: o feed só parava de
      // crescer, sem nada explicando o motivo nem caminho de volta.
      debugPrint('Falha ao paginar o feed de $_userId: $e');
      _erroAoCarregarMais = _mensagem(
        e,
        'Não foi possível carregar mais publicações',
      );
    } finally {
      _isLoadingMore = false;
      notifyListeners();
    }
  }

  /// Busca a partir de [cursor] até juntar ao menos um post ou acabar o feed.
  Future<_Carga> _carregar(String userId, {String? cursor}) async {
    final posts = <PublicationModel>[];
    var proximo = cursor;
    var paginas = 0;

    do {
      final page = await _feedService.getFeed(userId: userId, cursor: proximo);
      posts.addAll(
        page.items
            .where((item) => item.itemType == FeedItemType.userPost)
            .map(PublicationModel.fromFeedItem),
      );
      proximo = page.nextCursor;
      paginas++;
    } while (posts.isEmpty && proximo != null && paginas < _maxPaginasSemPost);

    return _Carga(posts: posts, nextCursor: proximo);
  }

  /// Mensagem já tratada pelo service (`apiErrorMessage`), sem o prefixo que o
  /// `toString()` da `Exception` acrescenta. Qualquer `Error` (um `TypeError`
  /// de parsing, por exemplo) cai no genérico: é texto de programador, não
  /// serve para a tela.
  String _mensagem(Object e, String fallback) =>
      e is Exception ? e.toString().replaceFirst('Exception: ', '') : fallback;

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
