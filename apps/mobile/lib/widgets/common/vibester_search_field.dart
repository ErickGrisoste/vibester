import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';

/// Campo de busca do Vibester.
///
/// Detalhes que o diferenciam de um `TextField` com ícone:
///
/// * O traço da esquerda em `ambar` cresce quando o campo ganha foco — o
///   estado ativo é comunicado por forma, não só por cor de borda.
/// * O texto digitado é DM Mono: busca é uma operação de sistema, e a fonte
///   reforça que ali se digita um termo, não se escreve uma frase.
/// * O botão de limpar só existe quando há texto, e tem 44px de alvo mesmo
///   com o ícone pequeno.
class VibesterSearchField extends StatefulWidget {
  final TextEditingController controller;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final String hint;
  final bool autofocus;

  const VibesterSearchField({
    super.key,
    required this.controller,
    this.onChanged,
    this.onSubmitted,
    this.hint = 'Buscar lugar, rolê ou pessoa',
    this.autofocus = false,
  });

  @override
  State<VibesterSearchField> createState() => _VibesterSearchFieldState();
}

class _VibesterSearchFieldState extends State<VibesterSearchField> {
  final _focusNode = FocusNode();
  bool _focused = false;

  @override
  void initState() {
    super.initState();
    _focusNode.addListener(
      () => setState(() => _focused = _focusNode.hasFocus),
    );
  }

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final hasText = widget.controller.text.isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: AppRadius.mdAll,
        border: Border.all(
          color: _focused
              ? colors.ambar.withValues(alpha: 0.6)
              : colors.hairline,
        ),
      ),
      child: Row(
        children: [
          AnimatedContainer(
            duration: context.adaptiveMotion(AppMotion.micro),
            curve: AppMotion.standard,
            width: AppStroke.marker,
            height: _focused ? 28 : 14,
            margin: const EdgeInsets.only(left: AppSpacing.md),
            decoration: BoxDecoration(
              color: _focused ? colors.ambar : colors.textDisabled,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: TextField(
              controller: widget.controller,
              focusNode: _focusNode,
              autofocus: widget.autofocus,
              textInputAction: TextInputAction.search,
              cursorColor: colors.ambar,
              style: context.typography.mono.copyWith(
                color: colors.textPrimary,
                fontSize: 14,
              ),
              onChanged: (value) {
                setState(() {});
                widget.onChanged?.call(value);
              },
              onSubmitted: widget.onSubmitted,
              decoration: InputDecoration(
                isDense: true,
                hintText: widget.hint,
                hintStyle: context.typography.bodyMedium.copyWith(
                  color: colors.textDisabled,
                ),
                border: InputBorder.none,
                contentPadding: const EdgeInsets.symmetric(
                  vertical: AppSpacing.lg,
                ),
              ),
            ),
          ),
          if (hasText)
            Semantics(
              button: true,
              label: 'Limpar busca',
              child: GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () {
                  widget.controller.clear();
                  setState(() {});
                  widget.onChanged?.call('');
                },
                child: SizedBox(
                  width: 44,
                  height: 44,
                  child: Icon(
                    Icons.close_rounded,
                    size: 18,
                    color: colors.textMuted,
                  ),
                ),
              ),
            )
          else
            Padding(
              padding: const EdgeInsets.only(right: AppSpacing.lg),
              child: Icon(
                Icons.search_rounded,
                size: 20,
                color: colors.textDisabled,
              ),
            ),
        ],
      ),
    );
  }
}
