import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/theme/vibester_dialog.dart';
import 'package:provider/provider.dart';

/// Confirma e exclui uma publicação do próprio usuário.
///
/// Único caminho de exclusão do app — usado pelo cartão do feed e pelo
/// detalhe do post. O `userId` enviado é sempre o da sessão, nunca o do post
/// (o post-service compara com o autor e responde 403 para qualquer outro).
/// A remoção no feed é otimista, ver [PublicationListProvider.deletePublication].
///
/// Devolve `true` quando o post foi excluído.
Future<bool> confirmAndDeletePost(
  BuildContext context, {
  required String postId,
}) async {
  final userProvider = context.read<UserProvider>();
  final userId = userProvider.user?.accountId;
  if (userId == null || postId.isEmpty) return false;

  // Lidos antes de qualquer `await`: no feed a remoção otimista desmonta o
  // próprio cartão que abriu este fluxo.
  final feed = context.read<PublicationListProvider>();
  final messenger = ScaffoldMessenger.of(context);
  final colors = context.colors;
  final type = context.typography;

  final confirmar = await showVibesterDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: colors.surfaceRaised,
      title: Text(
        'Excluir publicação',
        style: type.titleLarge.copyWith(color: colors.textPrimary),
      ),
      content: Text(
        'Ela some do seu perfil e do feed. Não dá pra desfazer.',
        style: type.bodyMedium.copyWith(color: colors.textSecondary),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(ctx, false),
          child: Text(
            'Cancelar',
            style: type.titleSmall.copyWith(color: colors.textMuted),
          ),
        ),
        TextButton(
          onPressed: () => Navigator.pop(ctx, true),
          child: Text(
            'Excluir',
            style: type.titleSmall.copyWith(color: colors.error),
          ),
        ),
      ],
    ),
  );

  if (confirmar != true) return false;

  HapticFeedback.mediumImpact();

  try {
    await feed.deletePublication(postId, userId);
    userProvider.ajustarTotalPosts(-1);
    messenger.showSnackBar(
      const SnackBar(content: Text('Publicação excluída')),
    );
    return true;
  } catch (e) {
    debugPrint('Exclusão do post $postId falhou: $e');
    messenger.showSnackBar(
      SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
    );
    return false;
  }
}
