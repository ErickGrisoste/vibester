import 'package:flutter/material.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/feed/publication_card.dart';
import 'package:provider/provider.dart';

class FeedScreen extends StatefulWidget {
  final ValueNotifier<bool>? navbarVisibleNotifier;

  const FeedScreen({super.key, this.navbarVisibleNotifier});

  @override
  State<FeedScreen> createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final _scrollController = ScrollController();

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
                      style: TextStyle(color: context.colors.textDisabled),
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
                        style: TextStyle(color: context.colors.ambar),
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
                  return PublicationCard(publication: publications[index]);
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
                  duration: const Duration(milliseconds: 300),
                  curve: Curves.easeInOut,
                  child: AnimatedOpacity(
                    opacity: visible ? 1.0 : 0.0,
                    duration: const Duration(milliseconds: 300),
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
