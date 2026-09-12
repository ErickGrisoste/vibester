import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:intl/intl.dart';

class DatePickerField extends FormField<DateTime> {
  DatePickerField({
    super.key,
    required String labelText,
    required double height,
    DateTime? initialDate,
    void Function(DateTime)? onDateSelected,
    super.validator,
    super.autovalidateMode,
  }) : super(
         initialValue: initialDate,
         builder: (FormFieldState<DateTime> field) {
           return _DatePickerFieldView(
             labelText: labelText,
             height: height,
             selectedDate: field.value,
             errorText: field.errorText,
             onDateSelected: (picked) {
               field.didChange(picked);
               onDateSelected?.call(picked);
             },
           );
         },
       );
}

class _DatePickerFieldView extends StatelessWidget {
  final String labelText;
  final double height;
  final DateTime? selectedDate;
  final String? errorText;
  final ValueChanged<DateTime> onDateSelected;

  const _DatePickerFieldView({
    required this.labelText,
    required this.height,
    required this.selectedDate,
    required this.errorText,
    required this.onDateSelected,
  });

  Future<void> _pickDate(BuildContext context) async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: selectedDate ?? DateTime.now(),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: ColorScheme.dark(
              primary: context.colors.ambar,
              surface: Color(0xFF141414),
              onSurface: Colors.white,
            ),
            textTheme: Theme.of(context).textTheme.apply(
              bodyColor: Colors.white38,
              displayColor: Colors.white,
            ),
            textSelectionTheme: TextSelectionThemeData(
              cursorColor: context.colors.ambar,
              selectionColor: context.colors.ambar.withOpacity(0.4),
              selectionHandleColor: context.colors.ambar,
            ),
            inputDecorationTheme: InputDecorationTheme(
              labelStyle: TextStyle(color: context.colors.ambar),
              enabledBorder: OutlineInputBorder(
                borderSide: const BorderSide(color: Colors.white10),
                borderRadius: BorderRadius.circular(8),
              ),
              focusedBorder: OutlineInputBorder(
                borderSide: BorderSide(color: context.colors.ambar),
                borderRadius: BorderRadius.circular(8),
              ),
            ),
          ),
          child: child!,
        );
      },
    );

    if (picked != null) {
      onDateSelected(picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    final bool hasError = errorText != null;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        GestureDetector(
          onTap: () => _pickDate(context),
          child: Container(
            width: 350,
            height: height,
            padding: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: const Color(0xFF141414),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(
                color: hasError
                    ? Colors.redAccent
                    : (selectedDate != null
                          ? context.colors.ambar
                          : Colors.white10),
                width: 1.3,
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  selectedDate != null
                      ? DateFormat('dd/MM/yyyy', 'pt_BR').format(selectedDate!)
                      : labelText,
                  style: TextStyle(
                    color: selectedDate != null ? Colors.white : Colors.white54,
                  ),
                ),
                Icon(
                  Icons.calendar_today,
                  color: hasError ? Colors.redAccent : context.colors.ambar,
                  size: 18,
                ),
              ],
            ),
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 6, left: 4),
            child: Text(
              errorText!,
              style: const TextStyle(color: Colors.redAccent, fontSize: 12),
            ),
          ),
      ],
    );
  }
}
