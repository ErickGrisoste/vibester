import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/auth_storage_service.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:mobile/widgets/text-field/primary_text_field.dart';
import 'package:provider/provider.dart';

/// Entrar.
///
/// A lógica de autenticação é a mesma de antes, incluindo a ordem que importa:
/// `ApiClient.token` é setado **antes** do `getProfile`, senão a chamada sai
/// sem o header `Authorization`. O que mudou é a forma: os campos vinham com
/// largura fixa de 350px e rótulos posicionados por `EdgeInsets.only(right:
/// 290)` — um empurrão em pixels que só acerta o alinhamento no aparelho onde
/// foi medido. Agora tudo é fluido e os rótulos pertencem ao campo.
class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _userService = UserService();

  final _emailOuUsuarioController = TextEditingController();
  final _senhaController = TextEditingController();

  bool _isLoading = false;

  @override
  void dispose() {
    _emailOuUsuarioController.dispose();
    _senhaController.dispose();
    super.dispose();
  }

  Future<void> _entrar() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final emailOuUsuario = _emailOuUsuarioController.text.trim();
    final senha = _senhaController.text;

    try {
      final loginResponse = await _userService.login(
        emailOuUsername: emailOuUsuario,
        password: senha,
      );

      final token = loginResponse['token'];
      final accountId = loginResponse['accountId'];

      // Token precisa estar setado ANTES do getProfile, porque é o
      // interceptor que anexa o header Authorization na chamada.
      ApiClient.token = token;

      // A credencial já foi aceita e o token é válido a partir daqui. Uma
      // falha ao carregar o perfil não pode derrubar o login: entramos com os
      // dados mínimos da resposta de login e o perfil é recarregado depois.
      UserModel usuarioLogado;
      try {
        // Busca os dados completos do perfil usando o accountId (não o id de
        // login/auth), que é o que a API usa pra indexar o profile.
        final profileResponse = await _userService.getProfile(accountId);
        usuarioLogado = UserModel.fromProfileJson(
          profileResponse,
          accountId: accountId,
          token: token,
        );
      } catch (e) {
        debugPrint('Login OK, mas falhou ao carregar o perfil: $e');
        usuarioLogado = UserModel.fromLoginJson(loginResponse);
      }

      await AuthStorageService.saveSession(usuarioLogado);

      if (!mounted) return;
      context.read<UserProvider>().setUser(usuarioLogado);

      // Limpa toda a pilha do fluxo de login: a home passa a ser a única
      // rota, então o botão voltar do Android não retorna para o login.
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.home,
        (route) => false,
      );
    } catch (e) {
      // Mensagem tratada na tela; o detalhe da exceção só no log local.
      debugPrint('Falha no login: $e');

      // Se o login passou mas o perfil falhou, não fica meia sessão: o token
      // já estava no ApiClient para o getProfile.
      ApiClient.token = null;

      if (!mounted) return;
      setState(() => _isLoading = false);
      // Os services só lançam Exception com a mensagem já tratada
      // (apiErrorMessage) — é ela que diz se foi senha errada ou servidor.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is Exception
                ? e.toString().replaceFirst('Exception: ', '')
                : 'Não foi possível entrar. Confere seus dados.',
          ),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          Positioned(
            right: -120,
            top: -80,
            child: SprayGlow(color: colors.ambar, size: 300, intensity: 0.18),
          ),
          const Positioned.fill(child: Grain(opacity: 0.04, density: 0.4)),

          SafeArea(
            child: Form(
              key: _formKey,
              child: ListView(
                padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
                children: [
                  const ScreenHeader(
                    title: 'Bem-vindo\nde volta',
                    eyebrow: 'ENTRAR',
                  ),

                  Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.screen,
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        PrimaryTextField(
                          controller: _emailOuUsuarioController,
                          label: 'E-mail ou usuário',
                          icon: Icons.alternate_email_rounded,
                          keyboardType: TextInputType.emailAddress,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(320),
                          ],
                          validator: (value) =>
                              value == null || value.trim().isEmpty
                              ? 'Informe seu e-mail ou usuário'
                              : null,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        PrimaryTextField(
                          controller: _senhaController,
                          label: 'Senha',
                          icon: Icons.lock_outline_rounded,
                          obscure: true,
                          textInputAction: TextInputAction.done,
                          inputFormatters: [
                            LengthLimitingTextInputFormatter(64),
                          ],
                          onSubmitted: (_) => _entrar(),
                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Informe sua senha';
                            }
                            if (value.length < 8) {
                              return 'A senha tem pelo menos 8 caracteres';
                            }
                            return null;
                          },
                        ),

                        Align(
                          alignment: Alignment.centerRight,
                          child: VibesterPressable(
                            borderRadius: AppRadius.pillAll,
                            onTap: () => Navigator.pushNamed(
                              context,
                              AppRoutes.recoverPassword,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: AppSpacing.md,
                              ),
                              child: Text(
                                'ESQUECI MINHA SENHA',
                                style: context.typography.monoMicro.copyWith(
                                  color: colors.textMuted,
                                ),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: AppSpacing.lg),
                        VibesterButton(
                          label: 'Entrar',
                          state: _isLoading
                              ? VibesterButtonState.loading
                              : VibesterButtonState.idle,
                          onPressed: _entrar,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        Center(
                          child: VibesterPressable(
                            borderRadius: AppRadius.pillAll,
                            onTap: () => Navigator.pushReplacementNamed(
                              context,
                              AppRoutes.register,
                            ),
                            child: Padding(
                              padding: const EdgeInsets.all(AppSpacing.md),
                              child: Text.rich(
                                TextSpan(
                                  style: context.typography.bodyMedium.copyWith(
                                    color: colors.textMuted,
                                  ),
                                  children: [
                                    const TextSpan(
                                      text: 'Ainda não tem conta? ',
                                    ),
                                    TextSpan(
                                      text: 'Criar agora',
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
