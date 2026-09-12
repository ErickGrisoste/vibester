import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Campo de data.
///
/// Visualmente é o mesmo campo de `PrimaryTextField` (rótulo mono acima, caixa
/// com fio, erro com ícone abaixo), para o formulário não ter dois idiomas —
/// o de digitar e o de escolher. O calendário do sistema herda o tema do app,
/// então não precisa mais do `ColorScheme` montado à mão com hex solto
/// (`0xFF141414`) que existia aqui.
class DatePickerField extends FormField<DateTime> {
  DatePickerField({
    super.key,
    required String labelText,
    DateTime? initialDate,
    void Function(DateTime)? onDateSelected,
    super.validator,
    super.autovalidateMode,

    /// Mantido por compatibilidade com as chamadas existentes; a altura agora
    /// é definida pelo conteúdo, como nos demais campos.
    @Deprecated('A altura vem do conteúdo') double? height,
  }) : super(
         initialValue: initialDate,
         builder: (field) => _DatePickerFieldView(
           labelText: labelText,
           selectedDate: field.value,
           errorText: field.errorText,
           onDateSelected: (picked) {
             field.didChange(picked);
             onDateSelected?.call(picked);
           },
         ),
       );
}

class _DatePickerFieldView extends StatelessWidget {
  final String labelText;
  final DateTime? selectedDate;
  final String? errorText;
  final ValueChanged<DateTime> onDateSelected;

  const _DatePickerFieldView({
    required this.labelText,
    required this.selectedDate,
    required this.errorText,
    required this.onDateSelected,
  });

  Future<void> _pickDate(BuildContext context) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: selectedDate ?? DateTime(now.year - 18, now.month, now.day),
      firstDate: DateTime(1900),
      lastDate: now,
      helpText: 'QUANDO VOCÊ NASCEU',
      cancelText: 'CANCELAR',
      confirmText: 'OK',
    );

    if (picked != null) onDateSelected(picked);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final hasError = errorText != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          labelText.toUpperCase(),
          style: type.monoMicro.copyWith(
            color: hasError ? colors.error : colors.textMuted,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        VibesterPressable(
          onTap: () => _pickDate(context),
          borderRadius: AppRadius.mdAll,
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: AppSpacing.md,
              vertical: AppSpacing.lg,
            ),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: AppRadius.mdAll,
              border: Border.all(
                color: hasError ? colors.error : colors.hairline,
                width: hasError ? AppStroke.regular : AppStroke.hairline,
              ),
            ),
            child: Row(
              children: [
                Icon(Icons.cake_outlined, size: 19, color: colors.textDisabled),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Text(
                    selectedDate == null
                        ? 'Escolher data'
                        : DateFormat(
                            "d 'de' MMMM 'de' y",
                            'pt_BR',
                          ).format(selectedDate!),
                    style: type.bodyLarge.copyWith(
                      color: selectedDate == null
                          ? colors.textDisabled
                          : colors.textPrimary,
                    ),
                  ),
                ),
                Icon(
                  Icons.calendar_today_outlined,
                  size: 17,
                  color: colors.textMuted,
                ),
              ],
            ),
          ),
        ),
        if (hasError)
          Padding(
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
                    errorText!,
                    style: type.bodySmall.copyWith(color: colors.error),
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
