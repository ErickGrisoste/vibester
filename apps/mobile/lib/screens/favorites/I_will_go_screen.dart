import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/event/i_will_go_event_card.dart';
import 'package:provider/provider.dart';

class IWillGoScreen extends StatefulWidget {
  const IWillGoScreen({super.key});

  @override
  State<IWillGoScreen> createState() => _IWillGoScreenState();
}

class _IWillGoScreenState extends State<IWillGoScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final userId = context.read<UserProvider>().user?.accountId;
      if (userId != null) {
        context.read<EventsListProvider>().fetchCheckIns(
          userId: userId,
          force: true,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<EventModel> favorites = context
        .watch<EventsListProvider>()
        .checkIns;
    return ColoredBox(
      color: context.colors.noturno,
      child: ListView.builder(
        shrinkWrap: true,
        physics: const NeverScrollableScrollPhysics(),
        padding: EdgeInsets.only(top: 16),
        itemCount: favorites.length + 1,
        itemBuilder: (context, index) {
          if (index == 0) {
            return Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 24),
              child: Column(
                children: [
                  Row(
                    children: [
                      Text(
                        'Eventos confirmados',
                        style: TextStyle(
                          color: context.colors.textPrimary,
                          fontSize: 20,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  Row(
                    children: [
                      Text(
                        'Os eventos que você já confirmou presença.',
                        style: TextStyle(
                          color: context.colors.textDisabled,
                          fontSize: 12.5,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            );
          }

          return IWillGoEventCard(
            event: favorites[index - 1],
            onTap: () {
              Navigator.pushNamed(
                context,
                AppRoutes.eventDetail,
                arguments: favorites[index - 1],
              );
            },
          );
        },
      ),
    );
  }
}
