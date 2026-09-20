import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/providers/safety/block_provider.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/theme/vibester_dialog.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:provider/provider.dart';

/// Ações do menu ⋯ de uma publicação ou de um perfil.
///
/// Reúne as ações de segurança sobre conteúdo de outra pessoa e a exclusão
/// do próprio post — é o mesmo ⋯, só muda quem está olhando, então as duas
/// famílias moram na mesma folha em vez de cada tela inventar a sua.
enum SafetyAction {
  deletePost(
    'Excluir publicação',
    Icons.delete_outline_rounded,
    destructive: true,
  ),
  reportPost('Denunciar publicação', Icons.flag_outlined, destructive: true),
  reportProfile('Denunciar perfil', Icons.flag_outlined, destructive: true),
  block('Bloquear perfil', Icons.block_rounded, destructive: true),
  unblock('Desbloquear perfil', Icons.lock_open_rounded);

  const SafetyAction(this.label, this.icon, {this.destructive = false});

  final String label;
  final IconData icon;
  final bool destructive;
}

/// Folha de opções (⋯) de um post ou perfil.
Future<SafetyAction?> showSafetyActionsSheet(
  BuildContext context, {
  required List<SafetyAction> actions,
}) {
  final colors = context.colors;

  return showModalBottomSheet<SafetyAction>(
    context: context,
    useSafeArea: true,
    backgroundColor: colors.surfaceRaised,
    shape: const RoundedRectangleBorder(borderRadius: AppRadius.sheet),
    builder: (sheetContext) => Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          for (final action in actions)
            Semantics(
              button: true,
              label: action.label,
              excludeSemantics: true,
              child: VibesterPressable(
                onTap: () {
                  HapticFeedback.selectionClick();
                  Navigator.pop(sheetContext, action);
                },
                child: Container(
                  constraints: const BoxConstraints(minHeight: 56),
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.screen,
                  ),
                  child: Row(
                    children: [
                      Icon(
                        action.icon,
                        size: 22,
                        color: action.destructive
                            ? colors.error
                            : colors.textSecondary,
                      ),
                      const SizedBox(width: AppSpacing.lg),
                      Expanded(
                        child: Text(
                          action.label,
                          style: context.typography.titleMedium.copyWith(
                            color: action.destructive
                                ? colors.error
                                : colors.textPrimary,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    ),
  );
}

/// Confirma e bloqueia. Devolve `true` quando o bloqueio foi feito.
Future<bool> confirmAndBlockUser(
  BuildContext context, {
  required String accountId,
  required String displayName,
}) async {
  final blocks = context.read<BlockProvider>();
  final messenger = ScaffoldMessenger.of(context);
  final colors = context.colors;
  final type = context.typography;
  final nome = displayName.isEmpty ? 'este perfil' : displayName;

  final confirmar = await showVibesterDialog<bool>(
    context: context,
    builder: (ctx) => AlertDialog(
      backgroundColor: colors.surfaceRaised,
      title: Text(
        'Bloquear $nome?',
        style: type.titleLarge.copyWith(color: colors.textPrimary),
      ),
      content: Text(
        'Vocês deixam de se seguir, as publicações somem do seu feed e o '
        'perfil não consegue mais te seguir. Ninguém é avisado. Dá pra '
        'desfazer em Ajustes > Contas bloqueadas.',
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
            'Bloquear',
            style: type.titleSmall.copyWith(color: colors.error),
          ),
        ),
      ],
    ),
  );

  if (confirmar != true) return false;

  try {
    await blocks.block(accountId);
    HapticFeedback.mediumImpact();
    messenger.showSnackBar(const SnackBar(content: Text('Perfil bloqueado')));
    return true;
  } catch (e) {
    debugPrint('Falha ao bloquear $accountId: $e');
    messenger.showSnackBar(
      SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
    );
    return false;
  }
}

/// Desbloqueia sem confirmação (é o caminho de volta, não destrutivo).
Future<bool> unblockUser(BuildContext context, {required String accountId}) async {
  final blocks = context.read<BlockProvider>();
  final messenger = ScaffoldMessenger.of(context);

  try {
    await blocks.unblock(accountId);
    messenger.showSnackBar(const SnackBar(content: Text('Perfil desbloqueado')));
    return true;
  } catch (e) {
    debugPrint('Falha ao desbloquear $accountId: $e');
    messenger.showSnackBar(
      SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
    );
    return false;
  }
}
