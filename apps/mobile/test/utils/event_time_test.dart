import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/utils/event_time.dart';

EventModel evento({
  required DateTime inicio,
  DateTime? fim,
  String titulo = 'Festa',
  String local = 'Maringá',
}) => EventModel(
  id: 'e1',
  dataDoEvento: inicio,
  dataFimEvento: fim,
  titulo: titulo,
  categoria: 'Balada',
  localizacao: local,
  informacoes: '',
  artistas: '',
);

void main() {
  setUpAll(() async {
    await initializeDateFormatting('pt_BR', null);
  });

  final agora = DateTime.now();

  group('janela do evento', () {
    test('isHappeningNow é verdadeiro entre início e fim', () {
      final e = evento(
        inicio: agora.subtract(const Duration(hours: 1)),
        fim: agora.add(const Duration(hours: 1)),
      );
      expect(e.isHappeningNow, isTrue);
      expect(e.isUpcoming, isTrue);
    });

    test('sem dataFim, assume janela padrão de 6h a partir do início', () {
      final dentro = evento(inicio: agora.subtract(const Duration(hours: 5)));
      final fora = evento(inicio: agora.subtract(const Duration(hours: 7)));

      expect(dentro.isHappeningNow, isTrue);
      expect(fora.isHappeningNow, isFalse);
      expect(fora.isUpcoming, isFalse);
    });

    test('evento que ainda não começou não está acontecendo agora', () {
      final e = evento(inicio: agora.add(const Duration(hours: 3)));
      expect(e.isHappeningNow, isFalse);
      expect(e.isUpcoming, isTrue);
    });
  });

  group('rótulo do dia', () {
    test('hoje e amanhã têm rótulo próprio', () {
      expect(
        evento(inicio: agora.add(const Duration(hours: 2))).dayLabel,
        'HOJE',
      );

      final amanha = DateTime(
        agora.year,
        agora.month,
        agora.day,
      ).add(const Duration(days: 1, hours: 22));
      expect(evento(inicio: amanha).dayLabel, 'AMANHÃ');
    });

    test('depois de amanhã vira dia da semana + dia do mês', () {
      final depois = DateTime(
        agora.year,
        agora.month,
        agora.day,
      ).add(const Duration(days: 4, hours: 22));
      final label = evento(inicio: depois).dayLabel;

      expect(label, isNot('HOJE'));
      expect(label, isNot('AMANHÃ'));
      expect(label, equals(label.toUpperCase()));
      expect(label, contains(depois.day.toString().padLeft(2, '0')));
    });
  });

  group('contagem regressiva', () {
    test('mostra horas quando falta mais de uma hora', () {
      final e = evento(
        inicio: DateTime.now().add(const Duration(hours: 3, minutes: 5)),
      );
      expect(e.countdownLabel, 'COMEÇA EM 3H');
    });

    test('mostra minutos quando falta menos de uma hora', () {
      // Meio minuto de folga: `inMinutes` trunca, e o tempo que o próprio
      // teste leva pra rodar não pode derrubar a asserção.
      final e = evento(
        inicio: DateTime.now().add(const Duration(minutes: 25, seconds: 30)),
      );
      expect(e.countdownLabel, 'COMEÇA EM 25MIN');
    });

    test(
      'é nula quando falta mais de um dia — urgência sem lastro não vale',
      () {
        final e = evento(inicio: agora.add(const Duration(days: 2)));
        expect(e.countdownLabel, isNull);
      },
    );

    test('é nula depois que o evento começou', () {
      final e = evento(inicio: agora.subtract(const Duration(minutes: 10)));
      expect(e.countdownLabel, isNull);
    });
  });

  group('linha de metadado', () {
    test('junta dia, hora e local', () {
      final e = evento(
        inicio: DateTime(agora.year, agora.month, agora.day, 22, 30),
        local: 'Maringá',
      );

      expect(e.metaLine(), 'HOJE  ·  22:30  ·  MARINGÁ');
      expect(e.metaLine(includeLocation: false), 'HOJE  ·  22:30');
    });

    test('omite o local quando a API não mandou', () {
      final e = evento(
        inicio: DateTime(agora.year, agora.month, agora.day, 20, 0),
        local: '',
      );
      expect(e.metaLine(), 'HOJE  ·  20:00');
    });
  });

  group('formatDistance', () {
    test('metros arredondados em dezenas abaixo de 1km', () {
      expect(formatDistance(120), '120M');
      expect(formatDistance(456), '460M');
    });

    test('quilômetros com uma casa e vírgula acima de 1km', () {
      expect(formatDistance(1500), '1,5KM');
      expect(formatDistance(12340), '12,3KM');
    });

    test('sem distância, string vazia — nada de "0M" na tela', () {
      expect(formatDistance(null), '');
      expect(formatDistance(0), '');
      expect(formatDistance(-5), '');
    });
  });

  group('saudação', () {
    test('acompanha a faixa do dia', () {
      expect(greetingForNow(DateTime(2026, 1, 1, 3)), 'BOA MADRUGADA');
      expect(greetingForNow(DateTime(2026, 1, 1, 9)), 'BOM DIA');
      expect(greetingForNow(DateTime(2026, 1, 1, 15)), 'BOA TARDE');
      expect(greetingForNow(DateTime(2026, 1, 1, 22)), 'BOA NOITE');
    });
  });
}
