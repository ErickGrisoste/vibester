import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/service/event/event_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/widgets/cards/event/event_poster_card.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:provider/provider.dart';

/// Agenda de eventos.
///
/// Serve em dois contextos:
/// * tela cheia (rota `/event-list`, vinda do "ver tudo" das seções da
///   Home), com a agenda completa vinda de [EventsListProvider] (dado
///   compartilhado entre telas, com cache/staleness);
/// * aba dentro do detalhe de um estabelecimento (`placeId` informado), com
///   a lista vinda direto de [EventService.getEventsByEstablishment] — dado
///   específico daquele estabelecimento, sem sentido em cachear no provider
///   global de eventos.
///
/// Por isso o cabeçalho é opcional: dentro de uma aba, um título de tela
/// repetiria o que a aba já disse.
///
/// A lista é agrupada por dia, com a data como marcador em DM Mono: numa
/// agenda, o que o usuário procura primeiro é o dia, não o nome do evento.
class EventListScreen extends StatefulWidget {
  final bool showHeader;

  /// Quando informado, mostra só os eventos desse estabelecimento.
  final String? placeId;

  const EventListScreen({super.key, this.showHeader = false, this.placeId});

  @override
  State<EventListScreen> createState() => _EventListScreenState();
}

class _EventListScreenState extends State<EventListScreen> {
  final EventService _eventService = EventService();

  List<EventModel> _placeEvents = [];
  bool _isLoadingPlace = true;
  String? _placeError;

  bool get _isPlaceScoped =>
      widget.placeId != null && widget.placeId!.isNotEmpty;

  @override
  void initState() {
    super.initState();
    if (_isPlaceScoped) {
      _fetchPlaceEvents();
    } else {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        context.read<EventsListProvider>().fetchEvents();
      });
    }
  }

  Future<void> _fetchPlaceEvents() async {
    setState(() {
      _isLoadingPlace = true;
      _placeError = null;
    });

    try {
      _placeEvents = await _eventService.getEventsByEstablishment(
        widget.placeId!,
      );
    } catch (e) {
      _placeError = 'Não foi possível carregar os eventos do local';
    } finally {
      if (mounted) setState(() => _isLoadingPlace = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    final bool isLoading;
    final String? error;
    final List<EventModel> allEvents;
    final Future<void> Function() onRefresh;

    if (_isPlaceScoped) {
      isLoading = _isLoadingPlace;
      error = _placeError;
      allEvents = _placeEvents;
      onRefresh = _fetchPlaceEvents;
    } else {
      final provider = context.watch<EventsListProvider>();
      isLoading = provider.isLoading;
      error = provider.error;
      allEvents = provider.events;
      onRefresh = () => context.read<EventsListProvider>().fetchEvents(
        force: true,
      );
    }

    final events = allEvents.where((e) => e.isUpcoming).toList()
      ..sort((a, b) => a.dataDoEvento.compareTo(b.dataDoEvento));

    final body = RefreshIndicator(
      color: colors.ambar,
      backgroundColor: colors.surface,
      onRefresh: onRefresh,
      child: _buildList(
        context,
        isLoading: isLoading,
        error: error,
        hasAnyData: allEvents.isNotEmpty,
        events: events,
        onRetry: onRefresh,
      ),
    );

    return Scaffold(
      backgroundColor: colors.noturno,
      body: widget.showHeader
          ? SafeArea(
              bottom: false,
              child: Column(
                children: [
                  const ScreenHeader(
                    title: 'A agenda',
                    eyebrow: 'TUDO QUE VEM POR AÍ',
                  ),
                  Expanded(child: body),
                ],
              ),
            )
          : body,
    );
  }

  Widget _buildList(
    BuildContext context, {
    required bool isLoading,
    required String? error,
    required bool hasAnyData,
    required List<EventModel> events,
    required VoidCallback onRetry,
  }) {
    if (isLoading && !hasAnyData) {
      return ListView.separated(
        padding: const EdgeInsets.all(AppSpacing.screen),
        itemCount: 5,
        separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.lg),
        itemBuilder: (_, _) => const VibesterSkeleton(height: 76),
      );
    }

    if (error != null && events.isEmpty) {
      return ListView(
        children: [VibesterState.error(message: error, onAction: onRetry)],
      );
    }

    if (events.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: [
          VibesterState(
            headline: 'Agenda vazia',
            message: _isPlaceScoped
                ? 'Esse lugar ainda não tem eventos marcados. Puxa pra '
                      'atualizar em alguns minutos.'
                : 'Nenhum evento marcado por enquanto. Puxa pra atualizar em '
                      'alguns minutos.',
            icon: Icons.event_busy_outlined,
          ),
        ],
      );
    }

    // Agrupa por dia mantendo a ordem cronológica.
    final grouped = <String, List<EventModel>>{};
    for (final event in events) {
      grouped.putIfAbsent(event.dayLabel, () => []).add(event);
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
        for (final entry in grouped.entries) ...[
          Padding(
            padding: const EdgeInsets.only(
              top: AppSpacing.lg,
              bottom: AppSpacing.sm,
            ),
            child: Text(
              entry.key,
              style: context.typography.monoEyebrow.copyWith(
                color: context.colors.ambar,
              ),
            ),
          ),
          for (final (i, event) in entry.value.indexed)
            StaggeredEntrance(
              index: i,
              child: EventPosterCard(
                event: event,
                variant: EventCardVariant.wide,
                hero: false,
              ),
            ),
        ],
      ],
    );
  }
}
