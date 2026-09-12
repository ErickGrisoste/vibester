import 'package:flutter/material.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/utils/app_progress_indicator.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/event/event_card.dart';
import 'package:provider/provider.dart';

class EventListScreen extends StatefulWidget {
  const EventListScreen({super.key});

  @override
  State<EventListScreen> createState() => _EventListScreenState();
}

class _EventListScreenState extends State<EventListScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<EventsListProvider>().fetchEvents();
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<EventsListProvider>();

    if (provider.isLoading) {
      return Scaffold(
        backgroundColor: context.colors.noturno,
        body: const Center(child: AppProgressIndicator()),
      );
    }

    if (provider.error != null) {
      return Scaffold(
        backgroundColor: context.colors.noturno,
        body: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              child: ConstrainedBox(
                constraints: BoxConstraints(minHeight: constraints.maxHeight),
                child: Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        height: 200,
                        width: 200,
                        child: Opacity(
                          opacity: 0.8,
                          child: Image.asset('assets/img/mascote/lupa.png'),
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        provider.error!,
                        style: TextStyle(
                          color: context.colors.textDisabled,
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
      );
    }

    final event = provider.events;
    return Scaffold(
      backgroundColor: context.colors.noturno,
      body: RefreshIndicator(
        color: context.colors.ambar,
        onRefresh: () =>
            context.read<EventsListProvider>().fetchEvents(force: true),
        child: ListView.builder(
          padding: const EdgeInsets.symmetric(vertical: 16),
          itemCount: event.length,
          itemBuilder: (context, index) {
            return EventCard(
              event: event[index],
              onTap: () {
                Navigator.pushNamed(
                  context,
                  AppRoutes.eventDetail,
                  arguments: event[index],
                );
              },
            );
          },
        ),
      ),
    );
  }
}
