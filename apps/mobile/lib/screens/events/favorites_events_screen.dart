import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/event/event_card.dart';
import 'package:provider/provider.dart';

class FavoritesEventsScreen extends StatefulWidget {
  // Quando embutida nas sub-abas do perfil, o refresh já é feito pelo
  // RefreshIndicator externo (UserProfileScreen), evitando indicators aninhados.
  final bool showRefreshIndicator;

  const FavoritesEventsScreen({super.key, this.showRefreshIndicator = true});

  @override
  State<FavoritesEventsScreen> createState() => _FavoritesEventsScreenState();
}

class _FavoritesEventsScreenState extends State<FavoritesEventsScreen>
    with AutomaticKeepAliveClientMixin<FavoritesEventsScreen> {
  @override
  bool get wantKeepAlive => true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<EventsListProvider>().fetchEvents();
    });
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    final List<EventModel> favorites = context
        .watch<EventsListProvider>()
        .favorites;

    final list = favorites.isEmpty
        ? ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              const SizedBox(height: 90),
              Center(
                child: SizedBox(
                  height: 200,
                  width: 200,
                  child: Opacity(
                    opacity: 0.8,
                    child: Image.asset('assets/img/mascote/lupa.png'),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              Center(
                child: Text(
                  'Nenhum evento confirmado',
                  style: TextStyle(
                    color: context.colors.textDisabled,
                    fontSize: 16,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          )
        : ListView.builder(
            padding: const EdgeInsets.symmetric(vertical: 16),
            itemCount: favorites.length,
            itemBuilder: (context, index) {
              return EventCard(
                event: favorites[index],
                onTap: () {
                  Navigator.pushNamed(
                    context,
                    AppRoutes.eventDetail,
                    arguments: favorites[index],
                  );
                },
              );
            },
          );

    return Scaffold(
      backgroundColor: context.colors.noturno,
      body: widget.showRefreshIndicator
          ? RefreshIndicator(
              color: context.colors.ambar,
              onRefresh: () =>
                  context.read<EventsListProvider>().fetchEvents(force: true),
              child: list,
            )
          : list,
    );
  }
}
