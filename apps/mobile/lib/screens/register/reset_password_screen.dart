import 'package:flutter/material.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/text-field/primary_text_field.dart';

/// Definir nova senha.
///
/// Atenção ao comportamento herdado: esta tela **não chama nenhum endpoint de
/// redefinição** — ela valida os campos e volta para o login. Não havia (e não
/// há) um método correspondente no `UserService`, e inventar a chamada aqui
/// seria criar uma funcionalidade que não existe do lado do servidor. O que dá
/// pra melhorar sem backend foi feito: a confirmação agora precisa bater com a
/// senha, e o mínimo de 8 caracteres é o mesmo do cadastro (antes só checava
/// se os campos estavam vazios, então "123" e "abc" passavam).
class ResetPasswordScreen extends StatefulWidget {
  const ResetPasswordScreen({super.key});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _senhaController = TextEditingController();
  final _confirmacaoController = TextEditingController();

  @override
  void dispose() {
    _senhaController.dispose();
    _confirmacaoController.dispose();
    super.dispose();
  }

  void _confirmar() {
    if (!_formKey.currentState!.validate()) return;

    // A tela de login já está na pilha (login → recover → reset); volta até
    // ela em vez de empilhar uma segunda instância.
    Navigator.popUntil(context, ModalRoute.withName(AppRoutes.login));
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
                  const ScreenHeader(title: 'Nova\nsenha', eyebrow: 'QUASE LÁ'),
                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.screen,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        PrimaryTextField(
                          controller: _senhaController,
                          label: 'Nova senha',
                          hint: 'Mínimo de 8 caracteres',
                          icon: Icons.lock_outline_rounded,
                          obscure: true,
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Informe a nova senha';
                            }
                            if (value.length < 8) {
                              return 'A senha precisa de pelo menos 8 caracteres';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        PrimaryTextField(
                          controller: _confirmacaoController,
                          label: 'Repetir a senha',
                          icon: Icons.lock_reset_rounded,
                          obscure: true,
                          textInputAction: TextInputAction.done,
                          onSubmitted: (_) => _confirmar(),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Repita a nova senha';
                            }
                            if (value != _senhaController.text) {
                              return 'As senhas não são iguais';
                            }
                            return null;
                          },
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        VibesterButton(
                          label: 'Confirmar senha',
                          onPressed: _confirmar,
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
