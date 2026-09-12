import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/notification/notification_model.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/relative_time.dart';

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
    final hasAvatar = notification.atorAvatarUrl?.isNotEmpty ?? false;
    final hasThumbnail =
        (notification.tipo == 'like' || notification.tipo == 'comment') &&
        (notification.postImagemUrl?.isNotEmpty ?? false);

    return InkWell(
      onTap: onTap,
      child: Card(
        color: notification.lida
            ? context.colors.navy
            : context.colors.navy.withOpacity(0.6),
        margin: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: context.colors.grey.withAlpha(80), width: 1),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              if (!notification.lida)
                Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: Container(
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: context.colors.brasa,
                    ),
                  ),
                ),

              ClipRRect(
                borderRadius: BorderRadius.circular(24),
                child: SizedBox(
                  height: 48,
                  width: 48,
                  child: hasAvatar
                      ? CachedNetworkImage(
                          imageUrl: notification.atorAvatarUrl!,
                          fit: BoxFit.cover,
                          memCacheWidth: 120,
                          fadeInDuration: Duration.zero,
                          fadeOutDuration: Duration.zero,
                          errorWidget: (_, _, _) => _fallbackAvatar(context),
                        )
                      : _fallbackAvatar(context),
                ),
              ),

              const SizedBox(width: 12),

              Expanded(
                child: RichText(
                  text: TextSpan(
                    style: GoogleFonts.inter(
                      color: context.colors.textPrimary,
                      fontSize: 14,
                    ),
                    children: [
                      TextSpan(
                        text: _nomeAtor,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      if (notification.outrosCount > 0)
                        TextSpan(text: ' e mais ${notification.outrosCount}'),
                      TextSpan(text: ' $_acao'),
                      TextSpan(
                        text:
                            '  ·  ${formatRelativeTime(notification.criadoEm)}',
                        style: TextStyle(
                          color: context.colors.textDisabled,
                          fontSize: 12,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              if (hasThumbnail) ...[
                const SizedBox(width: 12),
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: SizedBox(
                    height: 44,
                    width: 44,
                    child: CachedNetworkImage(
                      imageUrl: notification.postImagemUrl!,
                      fit: BoxFit.cover,
                      memCacheWidth: 120,
                      fadeInDuration: Duration.zero,
                      fadeOutDuration: Duration.zero,
                      errorWidget: (_, _, _) => Container(
                        color: context.colors.darkGrey,
                        child: Icon(
                          Icons.broken_image_outlined,
                          color: context.colors.textDisabled,
                          size: 18,
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  Widget _fallbackAvatar(BuildContext context) {
    return Container(
      color: context.colors.darkGrey,
      child: Icon(Icons.person, color: context.colors.textDisabled),
    );
  }
}
