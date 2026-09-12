import 'package:intl/intl.dart';
import 'package:mobile/models/event/event_model.dart';

/// Leitura temporal de um evento, na voz do produto.
///
/// Concentra num lugar só as perguntas que a interface faz o tempo todo — "é
/// hoje?", "já começou?", "que dia é isso?" — porque cada tela respondia por
/// conta própria com um `DateFormat` diferente, e o resultado era o mesmo
/// evento aparecendo como "QUI 12 SET  22:00" num card e "12/09" no outro.
///
/// Regra que atravessa tudo aqui: nada é afirmado sem dado. "ACONTECENDO
/// AGORA" só sai quando o horário realmente está dentro da janela do evento;
/// na ausência de `dataFimEvento`, assume-se uma janela padrão de 6h a partir
/// do início (a duração típica de um rolê noturno) em vez de fingir precisão
/// que a API não deu.
extension EventTime on EventModel {
  static const Duration _defaultDuration = Duration(hours: 6);

  DateTime get _end => dataFimEvento ?? dataDoEvento.add(_defaultDuration);

  bool get isToday => _isSameDay(dataDoEvento, DateTime.now());

  bool get isTomorrow =>
      _isSameDay(dataDoEvento, DateTime.now().add(const Duration(days: 1)));

  /// Já começou e ainda não terminou.
  bool get isHappeningNow {
    final now = DateTime.now();
    return now.isAfter(dataDoEvento) && now.isBefore(_end);
  }

  /// Ainda vai acontecer (inclui o que está rolando agora).
  bool get isUpcoming => DateTime.now().isBefore(_end);

  /// Rótulo curto do dia, para tag em card: 'HOJE', 'AMANHÃ' ou 'QUI 12'.
  String get dayLabel {
    if (isToday) return 'HOJE';
    if (isTomorrow) return 'AMANHÃ';
    return DateFormat('EEE dd', 'pt_BR').format(dataDoEvento).toUpperCase();
  }

  /// Hora de início: '22:00'.
  String get timeLabel => DateFormat('HH:mm').format(dataDoEvento);

  /// Linha de metadado completa de card: 'HOJE · 22:00 · MARINGÁ'.
  String metaLine({bool includeLocation = true}) => [
    dayLabel,
    timeLabel,
    if (includeLocation && localizacao.isNotEmpty) localizacao.toUpperCase(),
  ].join('  ·  ');

  /// Data por extenso, para tela de detalhe: 'quinta, 12 de setembro'.
  String get fullDateLabel =>
      DateFormat("EEEE, d 'de' MMMM", 'pt_BR').format(dataDoEvento);

  /// Contagem regressiva curta, só quando faz sentido mostrar urgência real:
  /// 'COMEÇA EM 3H', 'COMEÇA EM 25MIN'. Nulo se falta mais de um dia, se já
  /// começou ou se já acabou.
  String? get countdownLabel {
    final now = DateTime.now();
    if (!now.isBefore(dataDoEvento)) return null;

    final left = dataDoEvento.difference(now);
    if (left.inHours >= 24) return null;
    if (left.inHours >= 1) return 'COMEÇA EM ${left.inHours}H';
    return 'COMEÇA EM ${left.inMinutes}MIN';
  }
}

bool _isSameDay(DateTime a, DateTime b) =>
    a.year == b.year && a.month == b.month && a.day == b.day;

/// Saudação por faixa do dia, usada no cabeçalho da Home. Puramente derivada
/// do relógio do aparelho — não é personalização inventada.
String greetingForNow([DateTime? now]) {
  final hour = (now ?? DateTime.now()).hour;
  if (hour < 5) return 'BOA MADRUGADA';
  if (hour < 12) return 'BOM DIA';
  if (hour < 18) return 'BOA TARDE';
  return 'BOA NOITE';
}

/// Data de hoje na régua do cabeçalho: 'QUI  12 SET'.
String todayStamp([DateTime? now]) => DateFormat(
  'EEE  dd MMM',
  'pt_BR',
).format(now ?? DateTime.now()).toUpperCase();

/// Distância legível a partir de metros, como a API entrega
/// (`PlaceModel.distancia`). Abaixo de 1km mostra metros arredondados em
/// dezenas; acima, uma casa decimal.
String formatDistance(double? meters) {
  if (meters == null || meters <= 0) return '';
  if (meters < 1000) return '${(meters / 10).round() * 10}M';
  return '${(meters / 1000).toStringAsFixed(1).replaceAll('.', ',')}KM';
}
