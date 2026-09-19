import 'package:flutter/material.dart';
import 'package:mobile/models/notification/notification_model.dart';
import 'package:mobile/providers/notification/notification_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/cards/notification/notification_card.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:provider/provider.dart';

/// Notificações.
///
/// Antes era a terceira aba de dentro da tela de favoritos — um lugar onde
/// ninguém procuraria por elas, e que exigia dois toques mesmo quando havia
/// não lidas. Agora é uma tela própria, chamada pelo sino do cabeçalho de
/// HOJE, com o contador visível de fora.
///
/// A marcação como lida continua acontecendo só depois do primeiro quadro:
/// assim a seção "novas" permanece visível durante esta visita, e as
/// notificações só migram para "vistas" na próxima vez que a tela abrir.
class NotificationsScreen extends StatefulWidget {
  const NotificationsScreen({super.key});

  @override
  State<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends State<NotificationsScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load({bool force = false}) async {
    final userId = context.read<UserProvider>().user?.accountId;
    if (userId == null) return;

    await context.read<NotificationProvider>().fetchNotifications(
      userId,
      force: force,
    );
    if (!mounted) return;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<NotificationProvider>().markAllRead(userId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final provider = context.watch<NotificationProvider>();

    final novas = provider.notifications.where((n) => !n.lida).toList();
    final vistas = provider.notifications.where((n) => n.lida).toList();

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const ScreenHeader(
              title: 'Novidades',
              eyebrow: 'O QUE ROLOU ENQUANTO VOCÊ SUMIU',
            ),
            Expanded(
              child: RefreshIndicator(
                color: colors.ambar,
                backgroundColor: colors.surface,
                onRefresh: () => _load(force: true),
                child: _buildBody(context, provider, novas, vistas),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBody(
    BuildContext context,
    NotificationProvider provider,
    List<NotificationModel> novas,
    List<NotificationModel> vistas,
  ) {
    if (provider.isLoading && provider.notifications.isEmpty) {
      return ListView(
        padding: const EdgeInsets.all(AppSpacing.screen),
        children: const [
          VibesterSkeleton(height: 72, borderRadius: BorderRadius.zero),
          SizedBox(height: AppSpacing.md),
          VibesterSkeleton(height: 72),
          SizedBox(height: AppSpacing.md),
          VibesterSkeleton(height: 72),
        ],
      );
    }

    if (provider.error != null && provider.notifications.isEmpty) {
      return ListView(
        children: [
          VibesterState.error(
            message: provider.error!,
            onAction: () => _load(force: true),
          ),
        ],
      );
    }

    if (provider.notifications.isEmpty) {
      return ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        children: const [
          VibesterState(
            headline: 'Silêncio total',
            message:
                'Quando alguém curtir, comentar ou começar a te seguir, '
                'aparece aqui.',
            icon: Icons.notifications_none_rounded,
          ),
        ],
      );
    }

    return ListView(
      padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
      children: [
        if (novas.isNotEmpty) ...[
          const _GroupLabel('NOVAS'),
          for (final (i, n) in novas.indexed)
            StaggeredEntrance(
              index: i,
              child: NotificationCard(notification: n),
            ),
        ],
        if (vistas.isNotEmpty) ...[
          const _GroupLabel('JÁ VISTAS'),
          for (final (i, n) in vistas.indexed)
            StaggeredEntrance(
              index: i,
              child: NotificationCard(notification: n),
            ),
        ],
      ],
    );
  }
}

class _GroupLabel extends StatelessWidget {
  final String label;

  const _GroupLabel(this.label);

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.xl,
        AppSpacing.screen,
        AppSpacing.sm,
      ),
      child: Text(
        label,
        style: context.typography.monoEyebrow.copyWith(
          color: context.colors.textMuted,
        ),
      ),
    );
  }
}
