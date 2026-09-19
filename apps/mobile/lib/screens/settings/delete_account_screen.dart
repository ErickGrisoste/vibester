import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/providers/notification/notification_provider.dart';
import 'package:mobile/providers/safety/block_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/theme/vibester_dialog.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/text-field/primary_text_field.dart';
import 'package:provider/provider.dart';

/// Ajustes > Excluir conta (App Store Guideline 5.1.1(v)).
///
/// Exclusão de verdade, não desativação: o auth-service apaga a credencial e
/// publica `user.deleted`, que remove perfil, seguidores, bloqueios,
/// denúncias, publicações, mídias, curtidas, comentários e notificações.
/// A senha é pedida de novo para um aparelho destravado não bastar.
class DeleteAccountScreen extends StatefulWidget {
  final UserService? userService;

  const DeleteAccountScreen({super.key, this.userService});

  @override
  State<DeleteAccountScreen> createState() => _DeleteAccountScreenState();
}

class _DeleteAccountScreenState extends State<DeleteAccountScreen> {
  late final UserService _userService = widget.userService ?? UserService();
  final _formKey = GlobalKey<FormState>();
  final _senhaController = TextEditingController();
  bool _excluindo = false;

  static const _oQueSome = [
    'Seu perfil, nome de usuário e foto',
    'Suas publicações, fotos e vídeos',
    'Suas curtidas e comentários',
    'Quem você segue e quem te segue',
    'Seus bloqueios, denúncias e notificações',
  ];

  @override
  void dispose() {
    _senhaController.dispose();
    super.dispose();
  }

  Future<void> _excluir() async {
    if (_excluindo || !_formKey.currentState!.validate()) return;

    final colors = context.colors;
    final type = context.typography;

    final confirmar = await showVibesterDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.surfaceRaised,
        title: Text(
          'Excluir de vez?',
          style: type.titleLarge.copyWith(color: colors.textPrimary),
        ),
        content: Text(
          'Não dá pra desfazer nem recuperar a conta depois.',
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
              'Excluir conta',
              style: type.titleSmall.copyWith(color: colors.error),
            ),
          ),
        ],
      ),
    );

    if (confirmar != true || !mounted) return;

    setState(() => _excluindo = true);

    final navigator = Navigator.of(context);
    final messenger = ScaffoldMessenger.of(context);
    final userProvider = context.read<UserProvider>();
    final notificationProvider = context.read<NotificationProvider>();
    final blockProvider = context.read<BlockProvider>();

    try {
      await _userService.deleteAccount(password: _senhaController.text);
    } catch (e) {
      debugPrint('Falha ao excluir conta: $e');
      if (!mounted) return;
      setState(() => _excluindo = false);
      messenger.showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
      return;
    }

    HapticFeedback.heavyImpact();
    try {
      await userProvider.logout();
    } catch (e) {
      // A conta já não existe no servidor: falhar ao limpar o armazenamento
      // local não pode prender a pessoa nesta tela. O token que sobrar vence
      // sozinho e o 401 seguinte encerra a sessão.
      debugPrint('Falha ao limpar a sessão local após excluir a conta: $e');
    }
    notificationProvider.clear();
    blockProvider.clear();

    navigator.pushNamedAndRemoveUntil(AppRoutes.initialScreen, (_) => false);
    messenger.showSnackBar(
      const SnackBar(content: Text('Sua conta foi excluída.')),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        child: Form(
          key: _formKey,
          child: ListView(
            padding: const EdgeInsets.only(bottom: AppSpacing.huge),
            children: [
              const ScreenHeader(title: 'Excluir\nconta', eyebrow: 'ATENÇÃO'),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.screen,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Isso apaga sua conta do Vibester para sempre. Some:',
                      style: type.bodyLarge.copyWith(
                        color: colors.textSecondary,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    for (final item in _oQueSome)
                      Padding(
                        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(top: 2),
                              child: Icon(
                                Icons.close_rounded,
                                size: 18,
                                color: colors.error,
                              ),
                            ),
                            const SizedBox(width: AppSpacing.sm),
                            Expanded(
                              child: Text(
                                item,
                                style: type.bodyMedium.copyWith(
                                  color: colors.textPrimary,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    const SizedBox(height: AppSpacing.md),
                    Text(
                      'A remoção nos nossos sistemas acontece em seguida e '
                      'pode levar alguns minutos para terminar.',
                      style: type.bodySmall.copyWith(color: colors.textMuted),
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    PrimaryTextField(
                      controller: _senhaController,
                      label: 'Confirme sua senha',
                      icon: Icons.lock_outline_rounded,
                      obscure: true,
                      enabled: !_excluindo,
                      textInputAction: TextInputAction.done,
                      inputFormatters: [LengthLimitingTextInputFormatter(128)],
                      onSubmitted: (_) => _excluir(),
                      validator: (value) => value == null || value.isEmpty
                          ? 'Digite sua senha para confirmar'
                          : null,
                    ),
                    const SizedBox(height: AppSpacing.xl),
                    VibesterButton(
                      label: 'Excluir minha conta',
                      icon: Icons.delete_forever_outlined,
                      variant: VibesterButtonVariant.outline,
                      state: _excluindo
                          ? VibesterButtonState.loading
                          : VibesterButtonState.idle,
                      onPressed: _excluir,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
