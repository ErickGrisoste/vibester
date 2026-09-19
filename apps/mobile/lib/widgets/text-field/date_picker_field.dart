import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/date_input.dart';
import 'package:mobile/widgets/text-field/date_wheel_sheet.dart';

/// Campo de data de nascimento.
///
/// Duas formas de responder a mesma pergunta, porque as pessoas respondem de
/// jeitos diferentes: **digitar** `01011999` no teclado numérico (a via mais
/// rápida para uma data que se sabe de cor) ou **rolar** a roda de dia/mês/ano
/// no botão do calendário. Antes só existia o calendário do sistema, que para
/// nascimento obriga a navegar mais de duas décadas mês a mês.
///
/// Visualmente é o mesmo campo de `PrimaryTextField` (rótulo mono acima, caixa
/// com fio, âmbar no foco, erro com ícone abaixo), para o formulário não ter
/// dois idiomas. Quando a data está completa e válida, a idade aparece ao lado
/// do rótulo — a confirmação de que o ano digitado é mesmo o pretendido.
class DatePickerField extends StatefulWidget {
  final String labelText;
  final DateTime? initialDate;
  final void Function(DateTime?)? onDateSelected;
  final String? Function(DateTime?)? validator;
  final AutovalidateMode? autovalidateMode;

  /// Data mais antiga aceita. Padrão: 1º de janeiro de [BrDate.minYear].
  final DateTime? firstDate;

  /// Data mais recente aceita. Padrão: hoje.
  final DateTime? lastDate;

  const DatePickerField({
    super.key,
    required this.labelText,
    this.initialDate,
    this.onDateSelected,
    this.validator,
    this.autovalidateMode,
    this.firstDate,
    this.lastDate,
  });

  @override
  State<DatePickerField> createState() => _DatePickerFieldState();
}

class _DatePickerFieldState extends State<DatePickerField> {
  late final TextEditingController _controller;
  final _focusNode = FocusNode();
  final _fieldKey = GlobalKey<FormFieldState<DateTime>>();

  bool _focused = false;

  DateTime get _firstDate => widget.firstDate ?? DateTime(BrDate.minYear);
  DateTime get _lastDate {
    final hoje = DateTime.now();
    return widget.lastDate ?? DateTime(hoje.year, hoje.month, hoje.day);
  }

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController(
      text: widget.initialDate == null ? '' : BrDate.format(widget.initialDate!),
    );
    _focusNode.addListener(
      () => setState(() => _focused = _focusNode.hasFocus),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  /// Regra de validação do texto digitado, antes do validador de quem usa o
  /// campo: vazio, incompleto, dia inexistente e fora do intervalo são erros
  /// de digitação, e a mensagem precisa dizer qual dos quatro é.
  String? _validar(DateTime? _) {
    final texto = _controller.text;
    final digitos = texto.replaceAll(RegExp(r'\D'), '');

    if (digitos.isEmpty) return widget.validator?.call(null);
    if (digitos.length < BrDate.digits) {
      return 'Complete a data (${BrDate.mask})';
    }

    final data = BrDate.parse(texto);
    if (data == null) return 'Esse dia não existe';
    if (data.isAfter(_lastDate)) return 'Essa data ainda não chegou';
    if (data.isBefore(_firstDate)) return 'Confere o ano';

    return widget.validator?.call(data);
  }

  void _aplicar(DateTime? data, {required bool vindoDaRoda}) {
    if (vindoDaRoda && data != null) {
      _controller.text = BrDate.format(data);
    }
    _fieldKey.currentState?.didChange(data);
    // Com autovalidação desligada (o padrão do formulário de cadastro), o erro
    // de uma tentativa anterior só sumiria no próximo "Criar conta". Revalidar
    // aqui faz a mensagem desaparecer no instante em que a data fica correta —
    // e nunca faz aparecer erro antes da pessoa terminar de digitar, porque só
    // roda quando a data está completa.
    if (data != null) _fieldKey.currentState?.validate();
    widget.onDateSelected?.call(data);
  }

  Future<void> _abrirRoda() async {
    FocusScope.of(context).unfocus();
    HapticFeedback.selectionClick();

    final escolhida = await showDateWheelSheet(
      context,
      initialDate: BrDate.parse(_controller.text) ?? widget.initialDate,
      firstDate: _firstDate,
      lastDate: _lastDate,
      title: widget.labelText,
    );

    if (escolhida == null || !mounted) return;
    _aplicar(escolhida, vindoDaRoda: true);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return FormField<DateTime>(
      key: _fieldKey,
      initialValue: widget.initialDate,
      validator: _validar,
      autovalidateMode: widget.autovalidateMode,
      builder: (field) {
        final hasError = field.hasError;
        final data = BrDate.parse(_controller.text);
        final idade = data == null ? null : BrDate.age(data);
        final borda = hasError
            ? colors.error
            : _focused
            ? colors.ambar
            : colors.hairline;

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    widget.labelText.toUpperCase(),
                    style: type.monoMicro.copyWith(
                      color: hasError
                          ? colors.error
                          : _focused
                          ? colors.ambar
                          : colors.textMuted,
                    ),
                  ),
                ),
                // Idade como eco do que foi digitado — some quando a data
                // ainda não está completa, então nunca mostra número errado.
                if (idade != null && idade >= 0 && !hasError)
                  Text(
                    '$idade ANOS',
                    style: type.monoMicro.copyWith(color: colors.ambar),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            AnimatedContainer(
              duration: context.adaptiveMotion(AppMotion.micro),
              curve: AppMotion.standard,
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: AppRadius.mdAll,
                border: Border.all(
                  color: borda,
                  width: _focused || hasError
                      ? AppStroke.regular
                      : AppStroke.hairline,
                ),
              ),
              child: Row(
                children: [
                  Padding(
                    padding: const EdgeInsets.only(left: AppSpacing.md),
                    child: Icon(
                      Icons.cake_outlined,
                      size: 19,
                      color: _focused ? colors.ambar : colors.textDisabled,
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      controller: _controller,
                      focusNode: _focusNode,
                      keyboardType: TextInputType.number,
                      textInputAction: TextInputAction.next,
                      cursorColor: colors.ambar,
                      inputFormatters: const [BrDateInputFormatter()],
                      style: type.bodyLarge.copyWith(
                        color: colors.textPrimary,
                        // Dígito de largura fixa: a data não "anda" enquanto
                        // é digitada.
                        fontFeatures: const [FontFeature.tabularFigures()],
                      ),
                      onChanged: (texto) =>
                          _aplicar(BrDate.parse(texto), vindoDaRoda: false),
                      decoration: InputDecoration(
                        hintText: BrDate.mask,
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
                  Semantics(
                    button: true,
                    label: 'Escolher data na roda',
                    child: GestureDetector(
                      behavior: HitTestBehavior.opaque,
                      onTap: _abrirRoda,
                      child: SizedBox(
                        width: 52,
                        height: 52,
                        child: Icon(
                          Icons.calendar_today_outlined,
                          size: 19,
                          color: colors.textMuted,
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
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
                              field.errorText!,
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
