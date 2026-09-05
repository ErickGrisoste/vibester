import 'package:flutter/material.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/screens/favorites/I_will_go_screen.dart';
import 'package:mobile/screens/favorites/favorites_screen.dart';
import 'package:mobile/screens/favorites/notifications_tab.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/divider.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:provider/provider.dart';

class UserFavoritesScreen extends StatefulWidget {
  const UserFavoritesScreen({super.key});

  @override
  State<UserFavoritesScreen> createState() => _UserFavoritesScreenState();
}

class _UserFavoritesScreenState extends State<UserFavoritesScreen> {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<EventsListProvider>().fetchEvents();
    });
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> tabs = [
      FavoritesScreen(),
      IWillGoScreen(),
      NotificationsTab(),
    ];
    final event = Provider.of<EventsListProvider>(context);
    final places = Provider.of<PlaceListProvider>(context);

    int lugaresFavoritos = places.favorites.length;
    int eventosConfirmados = event.favorites.length;

    return Scaffold(
      backgroundColor: context.colors.noturno,
      appBar: AppBar(
        backgroundColor: context.colors.navy,
        elevation: 0,
        centerTitle: true,
        automaticallyImplyLeading: false,
        title: Image.asset(
          'assets/img/logo/tipografia.png',
          height: 30,
          fit: BoxFit.contain,
        ),
      ),
      body: RefreshIndicator(
        color: context.colors.brasa,
        onRefresh: () => Future.wait([
          context.read<PlaceListProvider>().fetchPlaces(force: true),
          context.read<EventsListProvider>().fetchEvents(force: true),
        ]),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: EdgeInsets.only(
            left: 10,
            right: 10,
            bottom: MediaQuery.of(context).padding.bottom,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Container(
                margin: const EdgeInsets.only(
                  top: 15,
                  left: 16,
                  right: 16,
                  bottom: 20,
                ),
                child: Column(
                  children: [
                    Container(
                      margin: const EdgeInsets.only(bottom: 7),
                      child: Row(
                        children: [
                          Text(
                            "Sua Vibe",
                            style: TextStyle(
                              fontSize: 22,
                              color: context.colors.textPrimary,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                    Row(
                      children: [
                        Text(
                          "Lugares que você curte e eventos interessados",
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
              ),

              Container(
                width: double.infinity,
                height: 70,
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(15),
                  color: context.colors.navy,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Container(
                      alignment: Alignment.center,
                      margin: EdgeInsets.only(left: 16),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: context.colors.brasa,
                                width: 1,
                              ),
                            ),
                            child: Icon(
                              Icons.favorite_outline,
                              color: context.colors.brasa,
                              fontWeight: FontWeight(20),
                            ),
                          ),
                          Container(margin: EdgeInsets.only(left: 5)),
                          Container(
                            margin: const EdgeInsets.only(),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      lugaresFavoritos.toString(),
                                      style: TextStyle(
                                        color: context.colors.textPrimary,
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Text(
                                      " LUGARES",
                                      style: TextStyle(
                                        color: context.colors.textDisabled,
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                Text(
                                  "FAVORITOS",
                                  style: TextStyle(
                                    color: context.colors.textDisabled,
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    Container(
                      alignment: Alignment.center,
                      margin: EdgeInsets.only(right: 16),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(9),
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: context.colors.brasa,
                                width: 1,
                              ),
                            ),
                            child: Transform.rotate(
                              angle: -0.5,
                              child: FaIcon(
                                FontAwesomeIcons.ticket,
                                color: context.colors.brasa,
                                size: 21,
                              ),
                            ),
                          ),
                          Container(margin: EdgeInsets.only(left: 5)),
                          Container(
                            margin: const EdgeInsets.only(),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      eventosConfirmados.toString(),
                                      style: TextStyle(
                                        color: context.colors.textPrimary,
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    Text(
                                      " EVENTOS",
                                      style: TextStyle(
                                        color: context.colors.textDisabled,
                                        fontSize: 15,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ],
                                ),
                                Text(
                                  "CONFIRMADOS",
                                  style: TextStyle(
                                    color: context.colors.textDisabled,
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: ['Favoritos', 'Vou ir', 'Notificações']
                    .asMap()
                    .entries
                    .map((entry) {
                      final index = entry.key;
                      final label = entry.value;
                      final isActive = _currentIndex == index;

                      return GestureDetector(
                        onTap: () => setState(() => _currentIndex = index),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 24,
                            vertical: 12,
                          ),
                          child: Column(
                            children: [
                              Text(
                                label,
                                style: TextStyle(
                                  color: isActive
                                      ? context.colors.textPrimary
                                      : context.colors.textDisabled,
                                  fontWeight: isActive
                                      ? FontWeight.bold
                                      : FontWeight.normal,
                                  fontSize: 16,
                                ),
                              ),
                              const SizedBox(height: 4),
                              if (isActive)
                                Container(
                                  height: 3,
                                  width: 24,
                                  color: context.colors.brasa,
                                )
                              else
                                const SizedBox(height: 2),
                            ],
                          ),
                        ),
                      );
                    })
                    .toList(),
              ),

              MyDivider(height: 1, width: double.infinity),
              tabs[_currentIndex],
            ],
          ),
        ),
      ),
    );
  }
}
