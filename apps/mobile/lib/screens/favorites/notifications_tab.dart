import 'package:flutter/material.dart';
import 'package:mobile/providers/notification/notification_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/notification/notification_card.dart';
import 'package:provider/provider.dart';

class NotificationsTab extends StatefulWidget {
  const NotificationsTab({super.key});

  @override
  State<NotificationsTab> createState() => _NotificationsTabState();
}

class _NotificationsTabState extends State<NotificationsTab> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) async {
      final userId = context.read<UserProvider>().user?.accountId;
      if (userId == null) return;

      await context.read<NotificationProvider>().fetchNotifications(userId);
      if (!mounted) return;

      // Marca como lidas só depois do primeiro fetch renderizar a tela,
      // pra seção "Novas" continuar visível durante esta visita — só na
      // próxima vez que a aba for aberta é que elas aparecem em
      // "Visualizadas".
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        context.read<NotificationProvider>().markAllRead(userId);
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<NotificationProvider>();

    if (provider.isLoading && provider.notifications.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: CircularProgressIndicator(color: context.colors.ambar),
        ),
      );
    }

    if (provider.notifications.isEmpty) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 40),
        child: Center(
          child: Text(
            'Nenhuma notificação ainda',
            style: TextStyle(
              color: context.colors.textDisabled,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      );
    }

    final novas = provider.notifications.where((n) => !n.lida).toList();
    final visualizadas = provider.notifications.where((n) => n.lida).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (novas.isNotEmpty) ...[
          _SectionHeader(title: 'Novas'),
          ...novas.map((n) => NotificationCard(notification: n)),
        ],
        if (visualizadas.isNotEmpty) ...[
          _SectionHeader(title: 'Visualizadas'),
          ...visualizadas.map((n) => NotificationCard(notification: n)),
        ],
      ],
    );
  }
}

class _SectionHeader extends StatelessWidget {
  final String title;

  const _SectionHeader({required this.title});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
      child: Text(
        title,
        style: TextStyle(
          color: context.colors.textMuted,
          fontSize: 12,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.5,
        ),
      ),
    );
  }
}
