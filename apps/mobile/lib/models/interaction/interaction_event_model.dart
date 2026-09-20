/// Sinais que o app pode enviar ao interaction-service.
///
/// Espelha `CLIENT_INTERACTION_TYPES` de
/// `apps/services/interaction-service/src/types/interaction.types.ts`, e a regra
/// de origem é a mesma dos dois lados: **o cliente só manda o que só ele sabe**.
/// LIKE, UNLIKE, COMMENT e FOLLOW já viram evento Kafka no serviço de origem e a
/// API os **rejeita** — reenviá-los daqui seria duplicata, e permitiria a um
/// cliente hostil forjar engajamento que nunca aconteceu.
enum InteractionType {
  /// O item apareceu na tela. É o **denominador** da taxa de engajamento — o
  /// dado que hoje não existe e sem o qual nenhuma qualidade é calculável.
  impression('IMPRESSION'),

  /// Atenção longa no mesmo item. Sinal derivado da impressão, com tipo próprio
  /// porque tem peso no score; a duração em si viaja no `dwellMs` da impressão.
  dwell('DWELL'),

  /// Descarte rápido: o item ocupou a tela e foi embora em menos de um segundo.
  /// É julgamento negativo, e sai de graça do mesmo dado de impressão.
  skip('SKIP'),

  tapDetail('TAP_DETAIL'),
  profileOpen('PROFILE_OPEN'),
  notInterested('NOT_INTERESTED'),
  directionsClick('DIRECTIONS_CLICK'),
  ticketClick('TICKET_CLICK');

  const InteractionType(this.wire);

  /// Valor enviado à API.
  ///
  /// Não é derivado de `name`: o enum do Dart é camelCase e o contrato é
  /// SCREAMING_SNAKE. Converter por regra de string quebraria em silêncio no dia
  /// em que alguém adicionasse um tipo com formato diferente — e o preço do erro
  /// é o serviço responder 400 e o **lote inteiro** se perder.
  final String wire;
}

/// Tipo do item interagido. Espelha `ITEM_TYPES` do interaction-service.
enum InteractionItemType {
  post('POST'),
  event('EVENT'),
  establishment('ESTABLISHMENT'),
  user('USER');

  const InteractionItemType(this.wire);

  final String wire;
}

/// Onde no app a interação aconteceu. Espelha `INTERACTION_SOURCES`.
///
/// Existe para não misturar réguas: uma curtida na busca significa outra coisa
/// que uma curtida no feed, e sem este campo as duas entram no mesmo número.
enum InteractionSource {
  feed('FEED'),
  explore('EXPLORE'),
  profile('PROFILE'),
  search('SEARCH'),
  eventDetail('EVENT_DETAIL'),
  establishmentDetail('ESTABLISHMENT_DETAIL'),
  notification('NOTIFICATION');

  const InteractionSource(this.wire);

  final String wire;
}

/// Um evento de interação, no formato que o interaction-service aceita.
class InteractionEvent {
  /// UUID gerado pelo cliente. Entra na chave primária do Cassandra, então
  /// reenviar o mesmo evento sobrescreve a mesma linha em vez de duplicar.
  final String eventId;

  final InteractionType type;
  final String itemId;
  final InteractionItemType itemType;

  /// Quando o fato aconteceu **no relógio do celular**.
  ///
  /// O envio é em lote, então o servidor recebe o evento até 15s depois. Usar a
  /// hora de chegada perderia a ordem real e a duração real da sessão.
  final DateTime occurredAt;

  /// Autor do item. Sem ele não há a quem atribuir afinidade leitor-autor.
  final String? authorId;

  /// Posição do item na lista quando o evento ocorreu.
  ///
  /// É o campo mais sutil da lista: gente engaja mais no topo, sempre,
  /// independentemente do conteúdo. Sem a posição gravada, o modelo aprende que
  /// "o que foi promovido é bom" e vira profecia autorrealizável — conteúdo bom
  /// que nasceu na posição 30 nunca sobe.
  final int? position;

  /// Tempo em que o item ficou visível, em milissegundos.
  final int? dwellMs;

  final InteractionSource? source;

  InteractionEvent({
    required this.eventId,
    required this.type,
    required this.itemId,
    required this.itemType,
    required this.occurredAt,
    this.authorId,
    int? position,
    int? dwellMs,
    this.source,
  })  : position = position == null ? null : _clamp(position, _maxPosition),
        dwellMs = dwellMs == null ? null : _clamp(dwellMs, _maxDwellMs);

  /// Tetos do schema do interaction-service. Estourar qualquer um deles faz a
  /// API responder 400 e **descartar o lote inteiro**, não só o evento ruim —
  /// por isso o corte acontece aqui, na fronteira, e não em quem chama.
  static const int _maxPosition = 10000;
  static const int _maxDwellMs = 60 * 60 * 1000;

  static int _clamp(int value, int max) {
    if (value < 0) return 0;
    return value > max ? max : value;
  }

  /// O corpo enviado à API.
  ///
  /// Campo nulo é **omitido**, nunca enviado como `null`: o schema da rota é
  /// `additionalProperties: false` com tipos declarados, e um `null` em campo
  /// tipado reprova a validação — de novo derrubando o lote inteiro.
  Map<String, dynamic> toJson() {
    return {
      'eventId': eventId,
      'type': type.wire,
      'itemId': itemId,
      'itemType': itemType.wire,
      'occurredAt': occurredAt.toUtc().toIso8601String(),
      if (authorId != null) 'authorId': authorId,
      if (position != null) 'position': position,
      if (dwellMs != null) 'dwellMs': dwellMs,
      if (source != null) 'source': source!.wire,
    };
  }
}
