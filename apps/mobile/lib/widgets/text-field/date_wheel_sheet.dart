import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:intl/intl.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/date_input.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';

/// Roda de data em bottom sheet — dia, mês e ano lado a lado.
///
/// Substitui o calendário do sistema para data de nascimento. Um calendário
/// é bom para escolher um dia *perto de hoje*; para nascimento ele obriga a
/// navegar duas décadas mês a mês. Aqui o ano é uma coluna: quem nasceu em
/// 1999 rola até 1999 uma vez.
///
/// Devolve a data escolhida, ou `null` se a pessoa fechou o sheet.
Future<DateTime?> showDateWheelSheet(
  BuildContext context, {
  DateTime? initialDate,
  required DateTime firstDate,
  required DateTime lastDate,
  String title = 'Quando você nasceu',
}) {
  return showModalBottomSheet<DateTime>(
    context: context,
    isScrollControlled: true,
    builder: (_) => _DateWheelSheet(
      initialDate: initialDate,
      firstDate: firstDate,
      lastDate: lastDate,
      title: title,
    ),
  );
}

class _DateWheelSheet extends StatefulWidget {
  final DateTime? initialDate;
  final DateTime firstDate;
  final DateTime lastDate;
  final String title;

  const _DateWheelSheet({
    required this.initialDate,
    required this.firstDate,
    required this.lastDate,
    required this.title,
  });

  @override
  State<_DateWheelSheet> createState() => _DateWheelSheetState();
}

class _DateWheelSheetState extends State<_DateWheelSheet> {
  /// Altura da faixa selecionada e de cada item da roda.
  static const _itemExtent = 44.0;

  /// Itens visíveis acima e abaixo do selecionado (3 de cada lado).
  static const _wheelHeight = _itemExtent * 5;

  late FixedExtentScrollController _diaCtrl;
  late FixedExtentScrollController _mesCtrl;
  late FixedExtentScrollController _anoCtrl;

  late int _dia;
  late int _mes;
  late int _ano;

  int get _primeiroAno => widget.firstDate.year;
  int get _ultimoAno => widget.lastDate.year;

  @override
  void initState() {
    super.initState();

    final base = widget.initialDate ?? _dataPadrao();
    _dia = base.day;
    _mes = base.month;
    _ano = base.year;

    _diaCtrl = FixedExtentScrollController(initialItem: _dia - 1);
    _mesCtrl = FixedExtentScrollController(initialItem: _mes - 1);
    _anoCtrl = FixedExtentScrollController(initialItem: _ultimoAno - _ano);
  }

  /// Sem data escolhida, a roda abre onde a maioria do público está (18–27
  /// anos), e não em 1900 nem em hoje — abrir em "hoje" significaria rolar
  /// duas décadas de ano para todo mundo.
  DateTime _dataPadrao() {
    final alvo = DateTime(widget.lastDate.year - 22, 1, 1);
    if (alvo.isBefore(widget.firstDate)) return widget.firstDate;
    if (alvo.isAfter(widget.lastDate)) return widget.lastDate;
    return alvo;
  }

  @override
  void dispose() {
    _diaCtrl.dispose();
    _mesCtrl.dispose();
    _anoCtrl.dispose();
    super.dispose();
  }

  DateTime get _selecionada => DateTime(_ano, _mes, _dia);

  bool get _dentroDoIntervalo =>
      !_selecionada.isBefore(_truncar(widget.firstDate)) &&
      !_selecionada.isAfter(_truncar(widget.lastDate));

  DateTime _truncar(DateTime d) => DateTime(d.year, d.month, d.day);

  /// Fevereiro de ano não bissexto não tem dia 29: ao trocar mês ou ano, o
  /// dia selecionado é puxado de volta para o último dia válido, e a roda do
  /// dia acompanha — nunca fica mostrando um número que não existe.
  void _ajustarDia() {
    final maximo = BrDate.daysInMonth(_ano, _mes);
    if (_dia > maximo) {
      _dia = maximo;
      _diaCtrl.animateToItem(
        _dia - 1,
        duration: context.adaptiveMotion(const Duration(milliseconds: 200)),
        curve: Curves.easeOut,
      );
    }
  }

  void _onChanged(VoidCallback update) {
    HapticFeedback.selectionClick();
    setState(() {
      update();
      _ajustarDia();
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final valida = _dentroDoIntervalo;

    return SafeArea(
      top: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screen,
          0,
          AppSpacing.screen,
          AppSpacing.md,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              widget.title.toUpperCase(),
              textAlign: TextAlign.center,
              style: type.monoEyebrow.copyWith(color: colors.textMuted),
            ),
            const SizedBox(height: AppSpacing.lg),

            SizedBox(
              height: _wheelHeight,
              child: Stack(
                children: [
                  // Faixa da seleção: fica atrás dos números e marca onde é
                  // "o valor escolhido" sem precisar de negrito por linha.
                  Positioned.fill(
                    child: Center(
                      child: IgnorePointer(
                        child: Container(
                          height: _itemExtent,
                          decoration: BoxDecoration(
                            color: colors.ambar.withValues(alpha: 0.12),
                            borderRadius: AppRadius.smAll,
                            border: Border.all(
                              color: colors.ambar.withValues(alpha: 0.45),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                  Row(
                    children: [
                      Expanded(
                        flex: 3,
                        child: _Wheel(
                          controller: _diaCtrl,
                          itemExtent: _itemExtent,
                          count: BrDate.daysInMonth(_ano, _mes),
                          selectedIndex: _dia - 1,
                          semanticsLabel: 'Dia',
                          labelBuilder: (i) => '${i + 1}',
                          onSelected: (i) => _onChanged(() => _dia = i + 1),
                        ),
                      ),
                      Expanded(
                        flex: 5,
                        child: _Wheel(
                          controller: _mesCtrl,
                          itemExtent: _itemExtent,
                          count: 12,
                          selectedIndex: _mes - 1,
                          semanticsLabel: 'Mês',
                          labelBuilder: _nomeDoMes,
                          onSelected: (i) => _onChanged(() => _mes = i + 1),
                        ),
                      ),
                      Expanded(
                        flex: 4,
                        child: _Wheel(
                          controller: _anoCtrl,
                          itemExtent: _itemExtent,
                          // Do mais recente para o mais antigo: quem se
                          // cadastra hoje tem 20 e poucos anos, então o ano
                          // provável está a poucos itens do topo.
                          count: _ultimoAno - _primeiroAno + 1,
                          selectedIndex: _ultimoAno - _ano,
                          semanticsLabel: 'Ano',
                          labelBuilder: (i) => '${_ultimoAno - i}',
                          onSelected: (i) =>
                              _onChanged(() => _ano = _ultimoAno - i),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: AppSpacing.lg),
            Text(
              valida
                  ? '${BrDate.age(_selecionada)} ANOS'
                  : 'DATA FORA DO INTERVALO',
              textAlign: TextAlign.center,
              style: type.monoMicro.copyWith(
                color: valida ? colors.ambar : colors.error,
              ),
            ),
            const SizedBox(height: AppSpacing.md),

            VibesterButton(
              label: 'Confirmar',
              onPressed: valida
                  ? () => Navigator.of(context).pop(_selecionada)
                  : null,
            ),
          ],
        ),
      ),
    );
  }

  static String _nomeDoMes(int index) {
    final nome = DateFormat.MMMM('pt_BR').format(DateTime(2024, index + 1));
    return nome[0].toUpperCase() + nome.substring(1);
  }
}

/// Uma coluna da roda. O item selecionado é o único em cor cheia — os
/// vizinhos ficam esmaecidos para a leitura cair naturalmente no centro.
class _Wheel extends StatelessWidget {
  final FixedExtentScrollController controller;
  final double itemExtent;
  final int count;
  final int selectedIndex;
  final String semanticsLabel;
  final String Function(int index) labelBuilder;
  final ValueChanged<int> onSelected;

  const _Wheel({
    required this.controller,
    required this.itemExtent,
    required this.count,
    required this.selectedIndex,
    required this.semanticsLabel,
    required this.labelBuilder,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    return Semantics(
      label: semanticsLabel,
      value: selectedIndex >= 0 && selectedIndex < count
          ? labelBuilder(selectedIndex)
          : null,
      child: ListWheelScrollView.useDelegate(
        controller: controller,
        itemExtent: itemExtent,
        physics: const FixedExtentScrollPhysics(),
        diameterRatio: 1.6,
        perspective: 0.004,
        overAndUnderCenterOpacity: 0.45,
        onSelectedItemChanged: onSelected,
        childDelegate: ListWheelChildBuilderDelegate(
          childCount: count,
          builder: (context, index) {
            final selecionado = index == selectedIndex;
            return Center(
              child: Text(
                labelBuilder(index),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: type.titleMedium.copyWith(
                  color: selecionado ? colors.textPrimary : colors.textMuted,
                  fontWeight: selecionado ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
