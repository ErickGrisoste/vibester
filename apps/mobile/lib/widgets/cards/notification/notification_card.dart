import 'package:flutter/material.dart';
import 'package:mobile/models/notification/notification_model.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/relative_time.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Linha de notificação.
///
/// Deixou de ser um `Card` com borda e margem própria: numa lista de vinte
/// itens, vinte caixas empilhadas viram uma parede. Aqui é uma linha separada
/// por fio, e o "não lida" é marcado por uma barra em `brasa` na lateral —
/// posição fixa, alinhada com o avatar, em vez de um ponto que empurrava todo
/// o conteúdo para o lado quando aparecia.
class NotificationCard extends StatelessWidget {
  final NotificationModel notification;
  final VoidCallback? onTap;

  const NotificationCard({super.key, required this.notification, this.onTap});

  String get _nomeAtor => (notification.atorNome?.isNotEmpty ?? false)
      ? notification.atorNome!
      : 'Alguém';

  String get _acao {
    final plural = notification.outrosCount > 0;

    switch (notification.tipo) {
      case 'like':
        return plural ? 'curtiram sua publicação' : 'curtiu sua publicação';
      case 'comment':
        final conteudo = notification.conteudo;
        final trecho = conteudo.isNotEmpty ? ': "$conteudo"' : '';
        return plural
            ? 'comentaram sua publicação$trecho'
            : 'comentou sua publicação$trecho';
      case 'follow':
        return plural ? 'começaram a seguir você' : 'começou a seguir você';
      default:
        return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    final hasThumbnail =
        (notification.tipo == 'like' || notification.tipo == 'comment') &&
        (notification.postImagemUrl?.isNotEmpty ?? false);

    return VibesterPressable(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.screen,
          vertical: AppSpacing.md,
        ),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: colors.hairline)),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            // Barra de "não lida": ocupa espaço sempre, então a lista não
            // desloca quando as notificações são marcadas como vistas.
            Container(
              width: AppStroke.marker,
              height: 40,
              decoration: BoxDecoration(
                color: notification.lida ? Colors.transparent : colors.brasa,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(width: AppSpacing.md),

            ClipOval(
              child: SizedBox(
                width: 44,
                height: 44,
                child: VibesterImage(
                  source: notification.atorAvatarUrl ?? '',
                  placeholderIcon: Icons.person_outline_rounded,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.md),

            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text.rich(
                    TextSpan(
                      style: type.bodyMedium.copyWith(
                        color: colors.textSecondary,
                      ),
                      children: [
                        TextSpan(
                          text: _nomeAtor,
                          style: TextStyle(
                            fontWeight: FontWeight.w700,
                            color: colors.textPrimary,
                          ),
                        ),
                        if (notification.outrosCount > 0)
                          TextSpan(text: ' e mais ${notification.outrosCount}'),
                        TextSpan(text: ' $_acao'),
                      ],
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    formatRelativeTime(notification.criadoEm).toUpperCase(),
                    style: type.monoMicro.copyWith(color: colors.textDisabled),
                  ),
                ],
              ),
            ),

            if (hasThumbnail) ...[
              const SizedBox(width: AppSpacing.md),
              ClipRRect(
                borderRadius: AppRadius.stickerAll,
                child: SizedBox(
                  width: 44,
                  height: 44,
                  child: VibesterImage(
                    source: notification.postImagemUrl!,
                    placeholderIcon: Icons.photo_outlined,
                  ),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
