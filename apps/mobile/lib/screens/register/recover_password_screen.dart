import 'package:email_validator/email_validator.dart';
import 'package:flutter/material.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/screens/register/email_confirm_screen.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/theme/vibester_page_route.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/text-field/primary_text_field.dart';

/// Recuperar acesso.
///
/// Mesmo fluxo: valida o e-mail, abre a tela de código e, confirmado, segue
/// para a redefinição de senha. A validação passou a checar formato de e-mail
/// (antes só checava se o campo estava vazio, então um "asdf" seguia adiante
/// e só falhava depois) e a navegação usa a transição do app em vez de um
/// `MaterialPageRoute` cru no meio de um fluxo todo animado.
class RecoverPasswordScreen extends StatefulWidget {
  const RecoverPasswordScreen({super.key});

  @override
  State<RecoverPasswordScreen> createState() => _RecoverPasswordScreenState();
}

class _RecoverPasswordScreenState extends State<RecoverPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  void _enviarCodigo() {
    if (!_formKey.currentState!.validate()) return;

    final email = _emailController.text.trim();

    Navigator.push(
      context,
      vibesterFadeRoute(
        EmailConfirmScreen(
          senha: '',
          email: email,
          onEmailConfirmed: () => Navigator.pushNamed(
            context,
            AppRoutes.resetPassword,
            arguments: email,
          ),
        ),
        const RouteSettings(name: 'email-confirm-recovery'),
      ),
    );
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
                          'A gente manda um código de verificação pro seu '
                          'e-mail.',
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
