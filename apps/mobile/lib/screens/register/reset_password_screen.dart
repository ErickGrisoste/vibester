import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:mobile/widgets/motion/vibester_shake.dart';
import 'package:mobile/widgets/text-field/primary_text_field.dart';
import 'package:pinput/pinput.dart';

/// Definir nova senha com o código enviado por email
/// (`POST /auth/password/reset`).
///
/// O código é de uso único e expira em 10 minutos; errar 5 vezes descarta o
/// pedido e é preciso reenviar. Terminando, volta ao login.
class ResetPasswordScreen extends StatefulWidget {
  final String email;
  final UserService? userService;

  const ResetPasswordScreen({super.key, required this.email, this.userService});

  @override
  State<ResetPasswordScreen> createState() => _ResetPasswordScreenState();
}

class _ResetPasswordScreenState extends State<ResetPasswordScreen> {
  static const _codeLength = 6;
  static const _reenvioSegundos = 60;

  late final UserService _userService = widget.userService ?? UserService();
  final _formKey = GlobalKey<FormState>();
  final _codigoController = TextEditingController();
  final _senhaController = TextEditingController();
  final _confirmacaoController = TextEditingController();

  bool _salvando = false;
  bool _codigoInvalido = false;
  int _errorTick = 0;
  int _segundosParaReenviar = _reenvioSegundos;
  Timer? _timer;

  @override
  void initState() {
    super.initState();
    _iniciarContagem();
  }

  @override
  void dispose() {
    _timer?.cancel();
    _codigoController.dispose();
    _senhaController.dispose();
    _confirmacaoController.dispose();
    super.dispose();
  }

  void _iniciarContagem() {
    _timer?.cancel();
    setState(() => _segundosParaReenviar = _reenvioSegundos);
    _timer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return timer.cancel();
      setState(() => _segundosParaReenviar--);
      if (_segundosParaReenviar <= 0) timer.cancel();
    });
  }

  Future<void> _reenviar() async {
    final messenger = ScaffoldMessenger.of(context);
    _iniciarContagem();
    try {
      await _userService.requestPasswordReset(email: widget.email);
      messenger.showSnackBar(
        const SnackBar(content: Text('Código reenviado. Confere seu email.')),
      );
    } catch (e) {
      messenger.showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  Future<void> _confirmar() async {
    if (_salvando) return;

    final codigoCompleto = _codigoController.text.length == _codeLength;
    final formValido = _formKey.currentState!.validate();
    if (!codigoCompleto) {
      setState(() {
        _codigoInvalido = true;
        _errorTick++;
      });
    }
    if (!codigoCompleto || !formValido) return;

    setState(() => _salvando = true);
    final messenger = ScaffoldMessenger.of(context);

    try {
      await _userService.resetPassword(
        email: widget.email,
        code: _codigoController.text,
        password: _senhaController.text,
      );
      HapticFeedback.mediumImpact();
      if (!mounted) return;
      messenger.showSnackBar(
        const SnackBar(content: Text('Senha redefinida. Entra com a nova senha.')),
      );
      Navigator.pushNamedAndRemoveUntil(
        context,
        AppRoutes.login,
        (route) => route.settings.name == AppRoutes.initialScreen || route.isFirst,
      );
    } catch (e) {
      debugPrint('Falha ao redefinir senha: $e');
      if (!mounted) return;
      setState(() {
        _salvando = false;
        _codigoInvalido = true;
        _errorTick++;
      });
      messenger.showSnackBar(
        SnackBar(content: Text(e.toString().replaceFirst('Exception: ', ''))),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    final defaultTheme = PinTheme(
      width: 48,
      height: 58,
      textStyle: type.monoDisplay.copyWith(
        color: colors.textPrimary,
        fontSize: 22,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border.all(color: colors.hairline),
        borderRadius: AppRadius.smAll,
      ),
    );

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
                        Text.rich(
                          TextSpan(
                            style: type.bodyLarge.copyWith(
                              color: colors.textMuted,
                            ),
                            children: [
                              const TextSpan(
                                text: 'Se houver conta com esse email, o '
                                    'código chegou em\n',
                              ),
                              TextSpan(
                                text: widget.email,
                                style: TextStyle(
                                  color: colors.ambar,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xl),
                        VibesterShake(
                          trigger: _errorTick,
                          child: Pinput(
                            length: _codeLength,
                            controller: _codigoController,
                            defaultPinTheme: defaultTheme,
                            focusedPinTheme: defaultTheme.copyWith(
                              decoration: defaultTheme.decoration!.copyWith(
                                border: Border.all(
                                  color: colors.ambar,
                                  width: AppStroke.regular,
                                ),
                              ),
                            ),
                            errorPinTheme: defaultTheme.copyWith(
                              decoration: defaultTheme.decoration!.copyWith(
                                border: Border.all(
                                  color: colors.error,
                                  width: AppStroke.regular,
                                ),
                              ),
                            ),
                            forceErrorState: _codigoInvalido,
                            onChanged: (_) {
                              if (_codigoInvalido) {
                                setState(() => _codigoInvalido = false);
                              }
                            },
                          ),
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Align(
                          alignment: Alignment.centerLeft,
                          child: VibesterPressable(
                            borderRadius: AppRadius.pillAll,
                            onTap: _segundosParaReenviar > 0 ? null : _reenviar,
                            child: Padding(
                              padding: const EdgeInsets.symmetric(
                                vertical: AppSpacing.md,
                              ),
                              child: Text(
                                _segundosParaReenviar > 0
                                    ? 'REENVIAR CÓDIGO EM ${_segundosParaReenviar}S'
                                    : 'REENVIAR CÓDIGO',
                                style: type.monoMicro.copyWith(
                                  color: _segundosParaReenviar > 0
                                      ? colors.textDisabled
                                      : colors.ambar,
                                ),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(height: AppSpacing.lg),
                        PrimaryTextField(
                          controller: _senhaController,
                          label: 'Nova senha',
                          hint: 'Mínimo de 8 caracteres',
                          icon: Icons.lock_outline_rounded,
                          obscure: true,
                          enabled: !_salvando,
                          inputFormatters: [LengthLimitingTextInputFormatter(64)],
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
                          enabled: !_salvando,
                          textInputAction: TextInputAction.done,
                          inputFormatters: [LengthLimitingTextInputFormatter(64)],
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
                          label: 'Redefinir senha',
                          state: _salvando
                              ? VibesterButtonState.loading
                              : VibesterButtonState.idle,
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
