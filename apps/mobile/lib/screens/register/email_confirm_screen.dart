import 'package:flutter/material.dart';
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
import 'package:mobile/widgets/motion/vibester_shake.dart';
import 'package:pinput/pinput.dart';
import 'package:provider/provider.dart';

/// Confirmação de e-mail por código.
///
/// A tela serve dois fluxos com o mesmo código: ativar uma conta recém-criada
/// (segue para a edição de perfil) e confirmar identidade antes de redefinir a
/// senha (via [onEmailConfirmed]).
///
/// Duas correções vieram com o redesenho: o código tem 6 dígitos, mas a
/// validação local liberava com 5 (`length < 5`) e o erro só aparecia depois
/// da ida ao servidor; e o erro exibido era o `toString()` da exceção crua num
/// SnackBar. Agora a caixa de código treme quando o código é rejeitado —
/// resposta imediata, no lugar onde o erro aconteceu.
class EmailConfirmScreen extends StatefulWidget {
  final String email;
  final String senha;
  final VoidCallback? onEmailConfirmed;

  const EmailConfirmScreen({
    required this.email,
    required this.senha,
    this.onEmailConfirmed,
    super.key,
  });

  @override
  State<EmailConfirmScreen> createState() => _EmailConfirmScreenState();
}

class _EmailConfirmScreenState extends State<EmailConfirmScreen> {
  static const _codeLength = 6;

  bool _pinError = false;
  int _errorTick = 0;
  bool _isLoading = false;
  final _pinController = TextEditingController();
  final _userService = UserService();

  Future<void> _aoVerificar() async {
    if (widget.onEmailConfirmed != null) {
      widget.onEmailConfirmed!();
      return;
    }

    try {
      final loginResponse = await _userService.login(
        emailOuUsername: widget.email,
        password: widget.senha,
      );

      final token = loginResponse['token'];
      final accountId = loginResponse['accountId'];

      ApiClient.token = token;

      // Mesmo tratamento da tela de login: a conta já foi criada e o token é
      // válido, então falha ao carregar o perfil não desfaz o cadastro.
      UserModel usuarioLogado;
      try {
        final profileResponse = await _userService.getProfile(accountId);
        usuarioLogado = UserModel.fromProfileJson(
          profileResponse,
          accountId: accountId,
          token: token,
        );
      } catch (e) {
        debugPrint('Cadastro OK, mas falhou ao carregar o perfil: $e');
        usuarioLogado = UserModel.fromLoginJson(loginResponse);
      }

      await AuthStorageService.saveSession(usuarioLogado);

      if (!mounted) return;
      context.read<UserProvider>().setUser(usuarioLogado);

      Navigator.pushNamed(context, AppRoutes.profileEditing);
    } catch (e) {
      debugPrint(e.toString());
      ApiClient.token = null;
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Erro ao entrar após confirmação. Faça login manualmente.',
          ),
        ),
      );
      // Fallback de erro: descarta register e email-confirm, deixando
      // apenas a tela inicial abaixo do login.
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.login,
        ModalRoute.withName(AppRoutes.initialScreen),
      );
    }
  }

  Future<void> _verificarCodigo() async {
    if (_pinController.text.length < _codeLength) {
      setState(() {
        _pinError = true;
        _errorTick++;
      });
      return;
    }

    setState(() {
      _pinError = false;
      _isLoading = true;
    });

    try {
      await _userService.verifyEmail(
        email: widget.email,
        code: _pinController.text,
      );
      await _aoVerificar();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _pinError = true;
        _errorTick++;
      });
      debugPrint('Falha ao verificar código: $e');
      // A mensagem vem do auth-service: "Código inválido" (422) e "Serviço de
      // perfil indisponível" (502) pedem ações diferentes do usuário.
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e is Exception
                ? e.toString().replaceFirst('Exception: ', '')
                : 'Código inválido ou expirado',
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Dígito em DM Mono: é um código de sistema, não uma palavra.
    final defaultTheme = PinTheme(
      width: 48,
      height: 58,
      textStyle: context.typography.monoDisplay.copyWith(
        color: context.colors.textPrimary,
        fontSize: 22,
      ),
      decoration: BoxDecoration(
        color: context.colors.surface,
        border: Border.all(color: context.colors.hairline),
        borderRadius: AppRadius.smAll,
      ),
    );

    final focusedTheme = defaultTheme.copyWith(
      decoration: defaultTheme.decoration!.copyWith(
        border: Border.all(
          color: context.colors.ambar,
          width: AppStroke.regular,
        ),
      ),
    );

    final errorTheme = defaultTheme.copyWith(
      decoration: defaultTheme.decoration!.copyWith(
        border: Border.all(
          color: context.colors.error,
          width: AppStroke.regular,
        ),
      ),
    );

    return Scaffold(
      backgroundColor: context.colors.noturno,
      body: Stack(
        children: [
          const Positioned.fill(child: Grain(opacity: 0.04, density: 0.4)),
          SafeArea(
            child: ListView(
              padding: const EdgeInsets.only(bottom: AppSpacing.xxl),
              children: [
                const ScreenHeader(
                  title: 'Confirma\nseu e-mail',
                  eyebrow: 'ÚLTIMO PASSO',
                ),
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.screen,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text.rich(
                        TextSpan(
                          style: context.typography.bodyLarge.copyWith(
                            color: context.colors.textMuted,
                          ),
                          children: [
                            const TextSpan(text: 'Mandamos um código de 6 '),
                            const TextSpan(text: 'dígitos para\n'),
                            TextSpan(
                              text: widget.email,
                              style: TextStyle(
                                color: context.colors.ambar,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),

                      const SizedBox(height: AppSpacing.xxl),

                      // Treme a cada rejeição — inclusive quando é o mesmo
                      // erro de novo, porque o contador muda junto.
                      VibesterShake(
                        trigger: _errorTick,
                        child: Pinput(
                          length: _codeLength,
                          defaultPinTheme: defaultTheme,
                          focusedPinTheme: focusedTheme,
                          errorPinTheme: errorTheme,
                          controller: _pinController,
                          forceErrorState: _pinError,
                          onChanged: (_) {
                            if (_pinError) setState(() => _pinError = false);
                          },
                          onCompleted: (_) => _verificarCodigo(),
                        ),
                      ),

                      if (_pinError)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpacing.md),
                          child: Text(
                            'CÓDIGO INVÁLIDO OU INCOMPLETO',
                            style: context.typography.monoMicro.copyWith(
                              color: context.colors.error,
                            ),
                          ),
                        ),

                      const SizedBox(height: AppSpacing.xxl),
                      VibesterButton(
                        label: 'Verificar e-mail',
                        state: _isLoading
                            ? VibesterButtonState.loading
                            : VibesterButtonState.idle,
                        onPressed: _verificarCodigo,
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
