import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/widgets/cards/event/event_poster_card.dart';
import 'package:mobile/widgets/cards/place/place_tile.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:provider/provider.dart';
import 'package:mobile/theme/app_motion.dart';

/// SEUS ROLÊS — tudo que o usuário salvou ou confirmou.
///
/// Reúne o que antes eram três telas separadas dentro de uma aba de favoritos
/// (`favorites_screen`, `I_will_go_screen` e as notificações) menos as
/// notificações, que viraram tela própria. A pergunta que esta tela responde é
/// uma só — *o que eu já escolhi?* — e ela se divide em duas respostas:
/// **presença confirmada** (compromisso, tem data, vence) e **lugares
/// salvos** (referência, não vence).
///
/// A ordem importa: eventos confirmados vêm primeiro porque têm prazo. Os que
/// já passaram saem da lista principal e viram histórico no fim, em vez de
/// ficarem misturados com o que ainda vai acontecer.
class SavedScreen extends StatefulWidget {
  const SavedScreen({super.key});

  @override
  State<SavedScreen> createState() => _SavedScreenState();
}

class _SavedScreenState extends State<SavedScreen> {
  _SavedTab _tab = _SavedTab.events;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({bool force = false}) async {
    final userId = context.read<UserProvider>().user?.accountId;
    await Future.wait([
      context.read<PlaceListProvider>().fetchPlaces(force: force),
      if (userId != null)
        context.read<EventsListProvider>().fetchCheckIns(
          userId: userId,
          force: force,
        ),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final checkIns = context.watch<EventsListProvider>().checkIns;
    final savedPlaces = context.watch<PlaceListProvider>().favorites;

    final upcoming = checkIns.where((e) => e.isUpcoming).toList()
      ..sort((a, b) => a.dataDoEvento.compareTo(b.dataDoEvento));
    final past = checkIns.where((e) => !e.isUpcoming).toList()
      ..sort((a, b) => b.dataDoEvento.compareTo(a.dataDoEvento));

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            ScreenHeader(
              title: 'Seus rolês',
              eyebrow: 'SALVOS E CONFIRMADOS',
              bottomSpacing: AppSpacing.md,
            ),
            _Tabs(
              selected: _tab,
              counts: {
                _SavedTab.events: upcoming.length,
                _SavedTab.places: savedPlaces.length,
              },
              onSelected: (tab) => setState(() => _tab = tab),
            ),
            Expanded(
              child: RefreshIndicator(
                color: colors.ambar,
                backgroundColor: colors.surface,
                onRefresh: () => _load(force: true),
                child: switch (_tab) {
                  _SavedTab.events => _EventsList(
                    upcoming: upcoming,
                    past: past,
                  ),
                  _SavedTab.places => _PlacesList(places: savedPlaces),
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

enum _SavedTab {
  events('VOU IR'),
  places('LUGARES');

  const _SavedTab(this.label);
  final String label;
}

class _Tabs extends StatelessWidget {
  final _SavedTab selected;
  final Map<_SavedTab, int> counts;
  final ValueChanged<_SavedTab> onSelected;

  const _Tabs({
    required this.selected,
    required this.counts,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screen),
      child: Row(
        children: [
          for (final tab in _SavedTab.values)
            Expanded(
              child: Semantics(
                button: true,
                selected: tab == selected,
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => onSelected(tab),
                  child: AnimatedContainer(
                    duration: context.adaptiveMotion(AppMotion.micro),
                    curve: AppMotion.standard,
                    height: 48,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: tab == selected
                              ? colors.ambar
                              : colors.hairline,
                          width: tab == selected
                              ? AppStroke.marker
                              : AppStroke.hairline,
                        ),
                      ),
                    ),
                    child: Text(
                      '${tab.label}  ${counts[tab] ?? 0}',
                      style: context.typography.monoMicro.copyWith(
                        color: tab == selected
                            ? colors.textPrimary
                            : colors.textDisabled,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _EventsList extends StatelessWidget {
  final List<EventModel> upcoming;
  final List<EventModel> past;

  const _EventsList({required this.upcoming, required this.past});

  @override
  Widget build(BuildContext context) {
    if (upcoming.isEmpty && past.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          VibesterState(
            headline: 'Nenhum rolê marcado',
            message:
                'Quando você confirmar presença num evento, ele fica aqui '
                'com data e hora — pra você não perder.',
            icon: Icons.event_available_outlined,
          ),
        ],
      );
    }

    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.lg,
        AppSpacing.screen,
        AppSpacing.dockGap,
      ),
      children: [
        for (final (i, event) in upcoming.indexed)
          StaggeredEntrance(
            index: i,
            child: EventPosterCard(
              event: event,
              variant: EventCardVariant.wide,
              hero: false,
            ),
          ),
        if (past.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.xxl),
          Text(
            'JÁ ROLOU',
            style: context.typography.monoEyebrow.copyWith(
              color: context.colors.textDisabled,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          // Passado entra apagado: continua acessível como histórico, mas não
          // disputa atenção com o que ainda vai acontecer.
          Opacity(
            opacity: 0.45,
            child: Column(
              children: [
                for (final event in past)
                  EventPosterCard(
                    event: event,
                    variant: EventCardVariant.wide,
                    hero: false,
                  ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _PlacesList extends StatelessWidget {
  final List<PlaceModel> places;

  const _PlacesList({required this.places});

  @override
  Widget build(BuildContext context) {
    if (places.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          VibesterState(
            headline: 'Nada salvo ainda',
            message:
                'Salve os lugares que você quer acompanhar e veja o '
                'movimento deles direto daqui.',
            icon: Icons.bookmark_border_rounded,
          ),
        ],
      );
    }

    return ListView.builder(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.lg,
        AppSpacing.screen,
        AppSpacing.dockGap,
      ),
      itemCount: places.length,
      itemBuilder: (context, i) => StaggeredEntrance(
        index: i,
        child: PlaceTile(place: places[i], hero: false),
      ),
    );
  }
}
