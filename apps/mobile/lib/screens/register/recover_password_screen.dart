import 'package:email_validator/email_validator.dart';
import 'package:flutter/material.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/text-field/primary_text_field.dart';

/// Recuperar acesso: pede ao auth-service um código de redefinição
/// (`POST /auth/password/forgot`) e segue para a tela que o usa.
///
/// O backend responde igual exista ou não conta com o email, então a tela
/// também não distingue — só avisa para conferir a caixa de entrada.
class RecoverPasswordScreen extends StatefulWidget {
  final UserService? userService;

  const RecoverPasswordScreen({super.key, this.userService});

  @override
  State<RecoverPasswordScreen> createState() => _RecoverPasswordScreenState();
}

class _RecoverPasswordScreenState extends State<RecoverPasswordScreen> {
  late final UserService _userService = widget.userService ?? UserService();
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  bool _enviando = false;

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  Future<void> _enviarCodigo() async {
    if (_enviando || !_formKey.currentState!.validate()) return;

    final email = _emailController.text.trim();
    setState(() => _enviando = true);

    try {
      await _userService.requestPasswordReset(email: email);
      if (!mounted) return;
      Navigator.pushNamed(context, AppRoutes.resetPassword, arguments: email);
    } catch (e) {
      debugPrint('Falha ao pedir código de senha: $e');
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    } finally {
      if (mounted) setState(() => _enviando = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          const Positioned.fill(child: Grain(opacity: 0.04, density: 0.4)),
          SafeArea(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
                children: [
                  const ScreenHeader(
                    title: 'Recuperar\nacesso',
                    eyebrow: 'ESQUECEU A SENHA',
                  ),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.screen,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Informe o email da sua conta. A gente manda um '
                          'código de 6 dígitos pra você criar uma senha nova.',
                          style: context.typography.bodyLarge.copyWith(
                            color: colors.textMuted,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        PrimaryTextField(
                          controller: _emailController,
                          label: 'E-mail',
                          icon: Icons.mail_outline_rounded,
                          keyboardType: TextInputType.emailAddress,
                          textInputAction: TextInputAction.done,
                          enabled: !_enviando,
                          onSubmitted: (_) => _enviarCodigo(),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Informe seu e-mail';
                            }
                            if (!EmailValidator.validate(value.trim())) {
                              return 'Esse e-mail não parece válido';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        VibesterButton(
                          label: 'Enviar código',
                          state: _enviando
                              ? VibesterButtonState.loading
                              : VibesterButtonState.idle,
                          onPressed: _enviarCodigo,
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
