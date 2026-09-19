import 'package:flutter/material.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/models/interaction/interaction_event_model.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/routes/route_observer.dart';
import 'package:mobile/service/interaction/interaction_tracker.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/widgets/cards/feed/publication_card.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:mobile/widgets/tracking/tracked_feed_item.dart';
import 'package:provider/provider.dart';

class FeedScreen extends StatefulWidget {
  final ValueNotifier<bool>? navbarVisibleNotifier;

  const FeedScreen({super.key, this.navbarVisibleNotifier});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> with RouteAware {
  final _scrollController = ScrollController();

  /// Guardado aqui porque `context.read` não pode ser chamado no `dispose`.
  InteractionTracker? _tracker;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    _tracker = context.read<InteractionTracker>();

    final route = ModalRoute.of(context);

    if (route != null) {
      appRouteObserver.subscribe(this, route);
    }
  }

  /// Uma rota foi empilhada por cima — perfil do autor, detalhe do post.
  ///
  /// A partir daqui o `Overlay` para de pintar esta tela e o detector de
  /// visibilidade dos cards congela no último valor. Sem este aviso, o post
  /// que estava na tela acumularia atenção durante a visita à outra tela.
  @override
  void didPushNext() => _tracker?.pauseSurface();

  @override
  void didPopNext() => _tracker?.resumeSurface();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final userId = context.read<UserProvider>().user?.accountId;
      if (userId != null) {
        context.read<PublicationListProvider>().fetchPublications(userId);
      }
    });
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      context.read<PublicationListProvider>().loadMore();
    }
  }

  @override
  void dispose() {
    appRouteObserver.unsubscribe(this);
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<PublicationListProvider>();
    final List<PublicationModel> publications = provider.publications;
    final userId = context.read<UserProvider>().user?.accountId;

    return Container(
      color: context.colors.noturno,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          if (provider.isLoading)
            Center(
              child: CircularProgressIndicator(color: context.colors.ambar),
            )
          else if (provider.erro != null && publications.isEmpty)
            Center(
              child: Padding(
                padding: const EdgeInsets.all(24),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      provider.erro!,
                      style: context.typography.bodyMedium.copyWith(
                        color: context.colors.textDisabled,
                      ),
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () {
                        if (userId != null) {
                          provider.fetchPublications(userId, force: true);
                        }
                      },
                      child: Text(
                        'Tentar novamente',
                        style: context.typography.titleMedium.copyWith(
                          color: context.colors.ambar,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            )
          else
            RefreshIndicator(
              color: context.colors.ambar,
              onRefresh: () async {
                if (userId != null) {
                  await provider.fetchPublications(userId, force: true);
                }
              },
              child: ListView.builder(
                controller: _scrollController,
                padding: const EdgeInsets.only(bottom: 80, top: 20),
                itemCount: publications.length + (provider.hasMore ? 1 : 0),
                itemBuilder: (context, index) {
                  if (index >= publications.length) {
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 20),
                      child: Center(
                        child: CircularProgressIndicator(
                          color: context.colors.ambar,
                        ),
                      ),
                    );
                  }
                  final publication = publications[index];
                  final itemId = publication.id;

                  // Post recém criado, ainda só local: sem id não há o que
                  // rastrear, e um itemId vazio reprovaria o lote inteiro.
                  if (itemId == null) {
                    return StaggeredEntrance(
                      index: index,
                      child: PublicationCard(publication: publication),
                    );
                  }

                  final trackedItem = TrackedItem(
                    itemId: itemId,
                    itemType: InteractionItemType.post,
                    source: InteractionSource.feed,
                    position: index,
                    authorId: publication.authorId,
                  );

                  return StaggeredEntrance(
                    index: index,
                    child: TrackedFeedItem(
                      item: trackedItem,
                      child: PublicationCard(
                        publication: publication,
                        onAuthorTap: () => _tracker?.recordTap(
                          trackedItem,
                          InteractionType.profileOpen,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
          Positioned(
            bottom: 100,
            right: 16,
            child: ValueListenableBuilder<bool>(
              valueListenable:
                  widget.navbarVisibleNotifier ?? ValueNotifier(true),
              builder: (context, visible, child) {
                return AnimatedSlide(
                  offset: visible ? Offset.zero : const Offset(0, 3),
                  duration: context.adaptiveMotion(AppMotion.normal),
                  curve: AppMotion.standard,
                  child: AnimatedOpacity(
                    opacity: visible ? 1.0 : 0.0,
                    duration: context.adaptiveMotion(AppMotion.normal),
                    curve: AppMotion.standard,
                    child: child!,
                  ),
                );
              },
              child: FloatingActionButton(
                onPressed: () async {
                  await Navigator.pushNamed(context, AppRoutes.newPublication);
                  _scrollController.animateTo(
                    0,
                    duration: const Duration(milliseconds: 300),
                    curve: Curves.easeOut,
                  );
                  if (userId != null && context.mounted) {
                    context.read<PublicationListProvider>().fetchPublications(
                      userId,
                      force: true,
                    );
                  }
                },
                backgroundColor: context.colors.ambar,
                foregroundColor: context.colors.textPrimary,
                child: const Icon(Icons.add, size: 48),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
