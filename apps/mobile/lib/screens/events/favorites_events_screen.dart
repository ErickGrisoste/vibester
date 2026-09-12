import 'package:flutter/material.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/widgets/cards/event/event_poster_card.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:provider/provider.dart';

/// Eventos com presença confirmada.
///
/// A lista completa vive em "Seus rolês" (`SavedScreen`); esta tela existe
/// para a rota direta e para ser embutida sem cabeçalho nem pull-to-refresh
/// próprios quando já está dentro de outra tela rolável.
class FavoritesEventsScreen extends StatefulWidget {
  final bool showRefreshIndicator;

  const FavoritesEventsScreen({super.key, this.showRefreshIndicator = true});

  @override
  State<FavoritesEventsScreen> createState() => _FavoritesEventsScreenState();
}

class _FavoritesEventsScreenState extends State<FavoritesEventsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({bool force = false}) async {
    final userId = context.read<UserProvider>().user?.accountId;
    if (userId == null) return;
    await context.read<EventsListProvider>().fetchCheckIns(
      userId: userId,
      force: force,
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final events =
        context
            .watch<EventsListProvider>()
            .checkIns
            .where((e) => e.isUpcoming)
            .toList()
          ..sort((a, b) => a.dataDoEvento.compareTo(b.dataDoEvento));

    final list = events.isEmpty
        ? ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: const [
              VibesterState(
                headline: 'Nenhum rolê marcado',
                message:
                    'Confirme presença num evento e ele aparece aqui com '
                    'data e hora.',
                icon: Icons.event_available_outlined,
              ),
            ],
          )
        : ListView.builder(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.screen,
              AppSpacing.lg,
              AppSpacing.screen,
              AppSpacing.dockGap,
            ),
            itemCount: events.length,
            itemBuilder: (context, i) => StaggeredEntrance(
              index: i,
              child: EventPosterCard(
                event: events[i],
                variant: EventCardVariant.wide,
                hero: false,
              ),
            ),
          );

    final body = widget.showRefreshIndicator
        ? RefreshIndicator(
            color: colors.ambar,
            backgroundColor: colors.surface,
            onRefresh: () => _load(force: true),
            child: list,
          )
        : list;

    if (!widget.showRefreshIndicator) return body;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const ScreenHeader(title: 'Vou ir', eyebrow: 'PRESENÇA CONFIRMADA'),
            Expanded(child: body),
          ],
        ),
      ),
    );
  }
}
