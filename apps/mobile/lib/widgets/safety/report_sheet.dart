import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/models/safety/report_reason.dart';
import 'package:mobile/service/safety/safety_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:mobile/widgets/text-field/primary_text_field.dart';

/// Abre a denúncia de um perfil ou publicação e avisa o resultado.
///
/// Devolve `true` quando a denúncia foi enviada.
Future<bool> showReportSheet(
  BuildContext context, {
  required ReportTargetType targetType,
  required String targetId,
  String? targetOwnerId,
  SafetyService? service,
}) async {
  final messenger = ScaffoldMessenger.of(context);

  final enviada = await showModalBottomSheet<bool>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    backgroundColor: context.colors.surfaceRaised,
    shape: const RoundedRectangleBorder(borderRadius: AppRadius.sheet),
    builder: (_) => ReportSheet(
      targetType: targetType,
      targetId: targetId,
      targetOwnerId: targetOwnerId,
      service: service ?? SafetyService(),
    ),
  );

  if (enviada == true) {
    messenger.showSnackBar(
      const SnackBar(
        content: Text(
          'Denúncia enviada. A gente analisa em até 24 horas.',
        ),
      ),
    );
  }
  return enviada == true;
}

class ReportSheet extends StatefulWidget {
  final ReportTargetType targetType;
  final String targetId;
  final String? targetOwnerId;
  final SafetyService service;

  const ReportSheet({
    super.key,
    required this.targetType,
    required this.targetId,
    required this.service,
    this.targetOwnerId,
  });

  @override
  State<ReportSheet> createState() => _ReportSheetState();
}

class _ReportSheetState extends State<ReportSheet> {
  final _detalhesController = TextEditingController();
  ReportReason? _motivo;
  bool _enviando = false;
  String? _erro;

  @override
  void dispose() {
    _detalhesController.dispose();
    super.dispose();
  }

  Future<void> _enviar() async {
    final motivo = _motivo;
    if (motivo == null || _enviando) return;

    setState(() {
      _enviando = true;
      _erro = null;
    });

    try {
      await widget.service.report(
        targetType: widget.targetType,
        targetId: widget.targetId,
        targetOwnerId: widget.targetOwnerId,
        reason: motivo,
        details: _detalhesController.text,
      );
      HapticFeedback.mediumImpact();
      if (mounted) Navigator.pop(context, true);
    } catch (e) {
      debugPrint('Falha ao denunciar: $e');
      if (!mounted) return;
      setState(() {
        _enviando = false;
        _erro = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final alvo = widget.targetType == ReportTargetType.post
        ? 'publicação'
        : 'perfil';

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: ListView(
        shrinkWrap: true,
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screen,
          AppSpacing.xl,
          AppSpacing.screen,
          AppSpacing.xl,
        ),
        children: [
          Text(
            'Denunciar $alvo',
            style: type.titleLarge.copyWith(color: colors.textPrimary),
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            'Quem foi denunciado não fica sabendo quem denunciou. A gente '
            'analisa em até 24 horas e remove o que violar os Termos de Uso.',
            style: type.bodyMedium.copyWith(color: colors.textSecondary),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text(
            'QUAL O PROBLEMA?',
            style: type.monoEyebrow.copyWith(color: colors.ambar),
          ),
          const SizedBox(height: AppSpacing.sm),
          for (final motivo in ReportReason.values)
            _ReasonRow(
              label: motivo.label,
              selected: _motivo == motivo,
              onTap: _enviando ? null : () => setState(() => _motivo = motivo),
            ),
          const SizedBox(height: AppSpacing.lg),
          PrimaryTextField(
            controller: _detalhesController,
            label: 'Detalhes (opcional)',
            hint: 'Conta o que aconteceu',
            maxLines: 3,
            enabled: !_enviando,
            textInputAction: TextInputAction.newline,
            keyboardType: TextInputType.multiline,
            inputFormatters: [LengthLimitingTextInputFormatter(1000)],
          ),
          if (_erro != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(_erro!, style: type.bodySmall.copyWith(color: colors.error)),
          ],
          const SizedBox(height: AppSpacing.xl),
          VibesterButton(
            label: 'Enviar denúncia',
            state: _enviando
                ? VibesterButtonState.loading
                : VibesterButtonState.idle,
            onPressed: _motivo == null ? null : _enviar,
          ),
        ],
      ),
    );
  }
}

class _ReasonRow extends StatelessWidget {
  final String label;
  final bool selected;
  final VoidCallback? onTap;

  const _ReasonRow({required this.label, required this.selected, this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      selected: selected,
      label: label,
      excludeSemantics: true,
      child: VibesterPressable(
        onTap: onTap,
        borderRadius: AppRadius.smAll,
        child: Container(
          constraints: const BoxConstraints(minHeight: 48),
          padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: colors.hairline)),
          ),
          child: Row(
            children: [
              Icon(
                selected
                    ? Icons.radio_button_checked_rounded
                    : Icons.radio_button_off_rounded,
                size: 20,
                color: selected ? colors.ambar : colors.textMuted,
              ),
              const SizedBox(width: AppSpacing.md),
              Expanded(
                child: Text(
                  label,
                  style: context.typography.bodyLarge.copyWith(
                    color: selected ? colors.textPrimary : colors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
