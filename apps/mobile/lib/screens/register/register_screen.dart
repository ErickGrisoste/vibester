import 'package:email_validator/email_validator.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/date_picker_field.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:mobile/widgets/text-field/primary_text_field.dart';

/// Criar conta.
///
/// Mesmo contrato de antes (`name`, `username`, `email`, `password`,
/// `bornAt`), mesma regra de montar o `username` a partir do nome. O que
/// mudou é a leitura do formulário: rótulos presos aos campos em vez de
/// empurrados por padding lateral, um campo por linha com respiro constante,
/// e a prévia do `@usuario` que vai ser criado aparecendo enquanto a pessoa
/// digita o nome — antes ela só descobria o próprio username depois de a
/// conta existir.
class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final _formKey = GlobalKey<FormState>();
  final _userService = UserService();

  final _nomeController = TextEditingController();
  final _emailController = TextEditingController();
  final _senhaController = TextEditingController();
  DateTime? _dataNascimento;

  bool _isLoading = false;

  @override
  void dispose() {
    _nomeController.dispose();
    _emailController.dispose();
    _senhaController.dispose();
    super.dispose();
  }

  String _formatarBornAt(DateTime data) {
    final ano = data.year.toString().padLeft(4, '0');
    final mes = data.month.toString().padLeft(2, '0');
    final dia = data.day.toString().padLeft(2, '0');
    return '$ano-$mes-$dia';
  }

  String get _usernamePreview =>
      '@${_nomeController.text.trim().replaceAll(' ', '')}';

  Future<void> _criarConta() async {
    if (!_formKey.currentState!.validate()) return;
    if (_dataNascimento == null) return;

    setState(() => _isLoading = true);

    final nomeDigitado = _nomeController.text.trim();
    final usernameFormatado = '@${nomeDigitado.replaceAll(' ', '')}';
    final email = _emailController.text.trim();
    final senha = _senhaController.text;

    try {
      await _userService.register(
        name: nomeDigitado,
        username: usernameFormatado,
        email: email,
        password: senha,
        bornAt: _formatarBornAt(_dataNascimento!),
      );

      if (!mounted) return;
      Navigator.pushNamed(
        context,
        AppRoutes.emailConfirm,
        arguments: {'email': email, 'senha': senha},
      );
    } catch (e) {
      debugPrint('Falha no cadastro: $e');

      if (!mounted) return;
      setState(() => _isLoading = false);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível criar a conta. Tenta de novo.'),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final nome = _nomeController.text.trim();

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          Positioned(
            left: -130,
            top: -70,
            child: SprayGlow(color: colors.brasa, size: 300, intensity: 0.16),
          ),
          const Positioned.fill(child: Grain(opacity: 0.04, density: 0.4)),

          SafeArea(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
                children: [
                  const ScreenHeader(
                    title: 'Cria sua\nconta',
                    eyebrow: 'LEVA UM MINUTO',
                  ),

                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.screen,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        PrimaryTextField(
                          controller: _nomeController,
                          label: 'Nome',
                          icon: Icons.person_outline_rounded,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(60),
                          ],
                          onChanged: (_) => setState(() {}),
                          validator: (value) {
                            if (value == null || value.trim().isEmpty) {
                              return 'Informe seu nome';
                            }
                            if (value.contains('@')) {
                              return 'O nome não pode conter "@"';
                            }
                            return null;
                          },
                        ),
                        // Prévia do username derivado do nome: a regra existe
                        // no código, então é justo mostrar o resultado dela.
                        if (nome.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: AppSpacing.sm),
                            child: Text(
                              'SEU USUÁRIO VAI SER  $_usernamePreview',
                              style: context.typography.monoMicro.copyWith(
                                color: colors.ambar,
                              ),
                            ),
                          ),

                        const SizedBox(height: AppSpacing.lg),
                        PrimaryTextField(
                          controller: _emailController,
                          label: 'E-mail',
                          icon: Icons.mail_outline_rounded,
                          keyboardType: TextInputType.emailAddress,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(320),
                          ],
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

                        const SizedBox(height: AppSpacing.lg),
                        DatePickerField(
                          labelText: 'Data de nascimento',
                          initialDate: _dataNascimento,
                          onDateSelected: (data) =>
                              setState(() => _dataNascimento = data),
                          validator: (value) => value == null
                              ? 'Informe sua data de nascimento'
                              : null,
                        ),

                        const SizedBox(height: AppSpacing.lg),
                        PrimaryTextField(
                          controller: _senhaController,
                          label: 'Senha',
                          hint: 'Mínimo de 8 caracteres',
                          icon: Icons.lock_outline_rounded,
                          obscure: true,
                          textInputAction: TextInputAction.done,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(64),
                          ],
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Escolhe uma senha';
                            }
                            if (value.length < 8) {
                              return 'A senha precisa de pelo menos 8 caracteres';
                            }
                            return null;
                          },
                        ),

                        const SizedBox(height: AppSpacing.xl),
                        VibesterButton(
                          label: 'Criar conta',
                          state: _isLoading
                              ? VibesterButtonState.loading
                              : VibesterButtonState.idle,
                          onPressed: _criarConta,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Center(
                          child: VibesterPressable(
                            borderRadius: AppRadius.pillAll,
                            onTap: () => Navigator.pushReplacementNamed(
                              context,
                              AppRoutes.login,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(AppSpacing.md),
                              child: Text.rich(
                                TextSpan(
                                  style: context.typography.bodyMedium.copyWith(
                                    color: colors.textMuted,
                                  ),
                                  children: [
                                    const TextSpan(text: 'Já tem conta? '),
                                    TextSpan(
                                      text: 'Entrar',
                                      style: TextStyle(
                                        color: colors.ambar,
                                        fontWeight: FontWeight.w700,
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                          ),
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
