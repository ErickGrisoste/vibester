import 'package:flutter/material.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/feed/publication_card.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:provider/provider.dart';

/// FEED — o que as pessoas estão postando.
///
/// Mudou de lugar na arquitetura: era a primeira aba *dentro* da Home, ou
/// seja, a tela que abria o app era a rede social, e a descoberta ficava
/// escondida atrás de uma segunda aba. Aqui o feed é um destino próprio, e
/// quem abre o Vibester cai em HOJE — o produto abre respondendo "o que tem
/// pra fazer", não "quem postou".
///
/// O botão flutuante de publicar saiu: publicar agora é o botão central do
/// dock, disponível de qualquer destino, sem um FAB competindo com ele na
/// mesma tela.
class FeedScreen extends StatefulWidget {
  /// Mantido por compatibilidade com quem ainda navega para a rota `/feed`
  /// direto; a casca da Home não precisa mais dele para esconder a navegação.
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
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  void _load({bool force = false}) {
    final userId = context.read<UserProvider>().user?.accountId;
    if (userId == null) return;
    context.read<PublicationListProvider>().fetchPublications(
      userId,
      force: force,
    );
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 400) {
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
    final colors = context.colors;
    final provider = context.watch<PublicationListProvider>();
    final publications = provider.publications;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: colors.ambar,
          backgroundColor: colors.surface,
          onRefresh: () async => _load(force: true),
          child: CustomScrollView(
            controller: _scrollController,
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverToBoxAdapter(child: _FeedMasthead()),

              if (provider.isLoading && publications.isEmpty)
                const SliverToBoxAdapter(child: _FeedSkeleton())
              else if (provider.erro != null && publications.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: VibesterState.error(
                    message: provider.erro!,
                    onAction: () => _load(force: true),
                  ),
                )
              else if (publications.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: VibesterState(
                    headline: 'Feed vazio',
                    message:
                        'Siga gente que sai e o rolê aparece aqui. Ou seja '
                        'você a começar: publique o seu.',
                    icon: Icons.photo_camera_outlined,
                    actionLabel: 'Publicar agora',
                    onAction: () =>
                        Navigator.pushNamed(context, AppRoutes.newPublication),
                  ),
                )
              else
                SliverList.builder(
                  itemCount: publications.length,
                  itemBuilder: (context, index) => StaggeredEntrance(
                    index: index,
                    child: PublicationCard(
                      publication: publications[index],
                      index: index,
                    ),
                  ),
                ),

              if (provider.isLoadingMore)
                const SliverToBoxAdapter(
                  child: Padding(
                    padding: EdgeInsets.symmetric(
                      horizontal: AppSpacing.screen,
                      vertical: AppSpacing.lg,
                    ),
                    child: VibesterSkeleton(height: 220),
                  ),
                )
              else if (publications.isNotEmpty && !provider.hasMore)
                const SliverToBoxAdapter(child: _FeedEnd()),

              const SliverPadding(
                padding: EdgeInsets.only(bottom: AppSpacing.dockGap),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeedMasthead extends StatelessWidget {
  const _FeedMasthead();

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.lg,
        AppSpacing.screen,
        AppSpacing.sm,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'QUEM SAIU',
            style: context.typography.monoEyebrow.copyWith(color: colors.ambar),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'O rolê de quem\nvocê segue',
            style: context.typography.displayMedium.copyWith(
              color: colors.textPrimary,
            ),
          ),
        ],
      ),
    );
  }
}

class _FeedSkeleton extends StatelessWidget {
  const _FeedSkeleton();

  @override
  Widget build(BuildContext context) {
    return const Padding(
      padding: EdgeInsets.symmetric(
        horizontal: AppSpacing.screen,
        vertical: AppSpacing.lg,
      ),
      child: Column(
        children: [
          _PostSkeleton(),
          SizedBox(height: AppSpacing.xxl),
          _PostSkeleton(),
        ],
      ),
    );
  }
}

class _PostSkeleton extends StatelessWidget {
  const _PostSkeleton();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            const VibesterSkeleton(
              width: 36,
              height: 36,
              borderRadius: BorderRadius.all(Radius.circular(18)),
            ),
            const SizedBox(width: AppSpacing.md),
            const VibesterSkeleton(width: 120, height: 12),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        const AspectRatio(aspectRatio: 4 / 5, child: VibesterSkeleton()),
        const SizedBox(height: AppSpacing.md),
        const VibesterSkeletonLines(lines: 2),
      ],
    );
  }
}

/// Fim da lista — encerra o scroll com voz de produto em vez de silêncio.
class _FeedEnd extends StatelessWidget {
  const _FeedEnd();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xl),
      child: Center(
        child: Text(
          'VOCÊ VIU TUDO  ·  VAI SAIR DE CASA',
          style: context.typography.monoMicro.copyWith(
            color: context.colors.textDisabled,
          ),
        ),
      ),
    );
  }
}
