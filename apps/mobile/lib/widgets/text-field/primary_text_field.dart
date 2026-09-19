import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Campo de formulário do Vibester.
///
/// O rótulo fica **fora** da caixa, em DM Mono e caixa alta, em vez de flutuar
/// por cima da borda: num formulário curto isso lê mais rápido, não some
/// quando o campo está preenchido, e mantém a mesma voz de "sistema" das
/// etiquetas do resto do app.
///
/// A caixa comunica estado por forma e cor: fio de 1px em repouso, contorno
/// âmbar no foco, contorno vermelho quando há erro. O erro aparece abaixo,
/// com ícone — nunca só pela cor da borda (§56: não depender exclusivamente
/// de cor).
class PrimaryTextField extends StatefulWidget {
  final TextEditingController controller;
  final String label;
  final String? hint;
  final IconData? icon;
  final bool obscure;
  final TextInputType? keyboardType;
  final TextInputAction textInputAction;
  final String? Function(String?)? validator;
  final List<TextInputFormatter>? inputFormatters;
  final int maxLines;
  final bool enabled;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;

  /// Valida o campo quando a pessoa sai dele depois de ter digitado algo,
  /// sem esperar o envio do formulário. Depois que o erro aparece, o campo
  /// revalida a cada tecla, e o erro some assim que o valor fica certo.
  ///
  /// Desligado por padrão: vale para campos em que o formato pode ser
  /// conferido na hora (e-mail, por exemplo), não para todo campo.
  final bool validateOnBlur;

  const PrimaryTextField({
    super.key,
    required this.controller,
    required this.label,
    this.hint,
    this.icon,
    this.obscure = false,
    this.keyboardType,
    this.textInputAction = TextInputAction.next,
    this.validator,
    this.inputFormatters,
    this.maxLines = 1,
    this.enabled = true,
    this.onChanged,
    this.onSubmitted,
    this.validateOnBlur = false,
  });

  @override
  State<PrimaryTextField> createState() => _PrimaryTextFieldState();
}

class _PrimaryTextFieldState extends State<PrimaryTextField> {
  final _focusNode = FocusNode();
  final _fieldKey = GlobalKey<FormFieldState<String>>();
  bool _focused = false;
  bool _hidden = true;

  /// A pessoa digitou algo neste campo. Sair de um campo em que ela só tocou
  /// não acusa "campo vazio": isso fica para o envio do formulário.
  bool _edited = false;

  /// Já validou uma vez ao sair do campo: daqui em diante revalida a cada
  /// tecla, para o erro sumir assim que a pessoa corrigir.
  bool _validateOnChange = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(_onFocusChanged);
  }

  void _onFocusChanged() {
    setState(() => _focused = _focusNode.hasFocus);

    if (!_focusNode.hasFocus && widget.validateOnBlur && _edited) {
      _validateOnChange = true;
      _fieldKey.currentState?.validate();
    }
  }

  @override
  void dispose() {
    _focusNode.removeListener(_onFocusChanged);
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return FormField<String>(
      key: _fieldKey,
      initialValue: widget.controller.text,
      validator: widget.validator,
      builder: (state) {
        final hasError = state.hasError;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              widget.label.toUpperCase(),
              style: type.monoMicro.copyWith(
                color: hasError
                    ? colors.error
                    : _focused
                    ? colors.ambar
                    : colors.textMuted,
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            AnimatedContainer(
              duration: context.adaptiveMotion(AppMotion.micro),
              curve: AppMotion.standard,
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: AppRadius.mdAll,
                border: Border.all(
                  color: hasError
                      ? colors.error
                      : _focused
                      ? colors.ambar
                      : colors.hairline,
                  width: _focused || hasError
                      ? AppStroke.regular
                      : AppStroke.hairline,
                ),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  if (widget.icon != null)
                    Padding(
                      padding: const EdgeInsets.only(left: AppSpacing.md),
                      child: Icon(
                        widget.icon,
                        size: 19,
                        color: _focused ? colors.ambar : colors.textDisabled,
                      ),
                    ),
                  Expanded(
                    child: TextField(
                      controller: widget.controller,
                      focusNode: _focusNode,
                      enabled: widget.enabled,
                      obscureText: widget.obscure && _hidden,
                      keyboardType: widget.keyboardType,
                      textInputAction: widget.textInputAction,
                      inputFormatters: widget.inputFormatters,
                      maxLines: widget.obscure ? 1 : widget.maxLines,
                      cursorColor: colors.ambar,
                      style: type.bodyLarge.copyWith(color: colors.textPrimary),
                      onChanged: (value) {
                        _edited = true;
                        state.didChange(value);
                        if (_validateOnChange) state.validate();
                        widget.onChanged?.call(value);
                      },
                      onSubmitted: widget.onSubmitted,
                      decoration: InputDecoration(
                        hintText: widget.hint,
                        hintStyle: type.bodyLarge.copyWith(
                          color: colors.textDisabled,
                        ),
                        border: InputBorder.none,
                        isDense: true,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: AppSpacing.md,
                          vertical: AppSpacing.lg,
                        ),
                      ),
                    ),
                  ),
                  if (widget.obscure)
                    Semantics(
                      button: true,
                      label: _hidden ? 'Mostrar senha' : 'Esconder senha',
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () => setState(() => _hidden = !_hidden),
                        child: SizedBox(
                          width: 48,
                          height: 48,
                          child: Icon(
                            _hidden
                                ? Icons.visibility_outlined
                                : Icons.visibility_off_outlined,
                            size: 19,
                            color: colors.textMuted,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            // Espaço do erro é reservado: a tela não pula de altura quando a
            // validação falha.
            AnimatedSize(
              duration: context.adaptiveMotion(AppMotion.micro),
              alignment: Alignment.topLeft,
              child: hasError
                  ? Padding(
                      padding: const EdgeInsets.only(top: AppSpacing.sm),
                      child: Row(
                        children: [
                          Icon(
                            Icons.error_outline_rounded,
                            size: 13,
                            color: colors.error,
                          ),
                          const SizedBox(width: AppSpacing.xs + 2),
                          Expanded(
                            child: Text(
                              state.errorText!,
                              style: type.bodySmall.copyWith(
                                color: colors.error,
                              ),
                            ),
                          ),
                        ],
                      ),
                    )
                  : const SizedBox(width: double.infinity),
            ),
          ],
        );
      },
    );
  }
}