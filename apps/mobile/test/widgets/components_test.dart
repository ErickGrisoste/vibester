import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/theme/app_colors.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/utils/username.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/cards/event/event_poster_card.dart';
import 'package:mobile/widgets/cards/place/place_tile.dart';
import 'package:mobile/widgets/common/vibester_chip.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/common/vibester_tag.dart';
import 'package:mobile/widgets/indicators/movement_indicator.dart';
import 'package:mobile/widgets/navigation/navbar_background.dart';
import 'package:mobile/widgets/navigation/navbar_center_action.dart';
import 'package:mobile/widgets/navigation/navbar_item.dart';
import 'package:mobile/widgets/navigation/navbar_tokens.dart';
import 'package:mobile/widgets/navigation/vibester_navbar.dart';

import '../helpers/pump_app.dart';

void main() {
  setUpAll(setUpTestEnvironment);

  EventModel evento({
    DateTime? inicio,
    DateTime? fim,
    String titulo = 'Festival Subsolo',
  }) => EventModel(
    id: 'evt-1',
    dataDoEvento: inicio ?? DateTime.now().add(const Duration(hours: 5)),
    dataFimEvento: fim,
    titulo: titulo,
    categoria: 'Balada',
    localizacao: 'Maringá',
    informacoes: '',
    artistas: 'DJ Fulana',
  );

  final lugar = PlaceModel(
    id: 'place-1',
    nome: 'Bar do Zé',
    nivelMovimento: 5,
    categoria: 'Bar',
    avaliacao: 4.6,
    nivelPrecoMedio: 'medio',
    bio: '',
    endereco: 'Rua das Flores, 100',
    distribuicao: const [],
    qtdAvaliacoes: 73,
    distancia: 850,
  );

  group('EventPosterCard', () {
    for (final variante in EventCardVariant.values) {
      testWidgets('variante ${variante.name} renderiza sem estourar', (
        tester,
      ) async {
        await pumpComponent(
          tester,
          EventPosterCard(event: evento(), variant: variante, hero: false),
          size: TestScreens.small,
        );

        expect(find.text('Festival Subsolo'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets(
      'variante wide não estoura dentro de coluna com altura livre '
      '(caso real: seção "Essa semana" da Home, dentro de um sliver)',
      (tester) async {
        // Diferente de `pumpComponent` (que centraliza o card com altura
        // limitada pelo Scaffold), aqui o card fica dentro de um
        // `SingleChildScrollView` > `Column` — o mesmo tipo de altura
        // irrestrita que um `SliverToBoxAdapter` passa adiante. É esse
        // contexto que expunha o `BoxConstraints` infinito em `_DateBlock`.
        await tester.pumpWidget(
          MaterialApp(
            theme: AppTheme.dark,
            home: Scaffold(
              body: SingleChildScrollView(
                child: Column(
                  children: [
                    EventPosterCard(
                      event: evento(),
                      variant: EventCardVariant.wide,
                      hero: false,
                    ),
                  ],
                ),
              ),
            ),
          ),
        );

        expect(tester.takeException(), isNull);
      },
    );

    testWidgets('marca "ROLANDO AGORA" só quando o horário sustenta', (
      tester,
    ) async {
      final agora = DateTime.now();

      await pumpComponent(
        tester,
        EventPosterCard(
          event: evento(
            inicio: agora.subtract(const Duration(hours: 1)),
            fim: agora.add(const Duration(hours: 2)),
          ),
          hero: false,
        ),
      );
      expect(find.text('ROLANDO AGORA'), findsOneWidget);
    });

    testWidgets('evento futuro não recebe selo de urgência', (tester) async {
      await pumpComponent(
        tester,
        EventPosterCard(
          event: evento(inicio: DateTime.now().add(const Duration(days: 3))),
          hero: false,
        ),
      );
      expect(find.text('ROLANDO AGORA'), findsNothing);
      expect(find.text('HOJE'), findsNothing);
    });

    testWidgets('título longo trunca em vez de estourar', (tester) async {
      await pumpComponent(
        tester,
        EventPosterCard(
          event: evento(
            titulo:
                'Festival de música eletrônica com quatro palcos, feira de '
                'discos e after até o sol raiar na zona norte da cidade',
          ),
          hero: false,
        ),
        size: TestScreens.small,
      );
      expect(tester.takeException(), isNull);
    });
  });

  group('PlaceTile', () {
    for (final variante in PlaceTileVariant.values) {
      testWidgets('variante ${variante.name} renderiza', (tester) async {
        await pumpComponent(
          tester,
          PlaceTile(place: lugar, variant: variante, hero: false),
          size: TestScreens.small,
        );

        expect(find.text('Bar do Zé'), findsOneWidget);
        expect(tester.takeException(), isNull);
      });
    }

    testWidgets('mostra a distância quando a API mandou', (tester) async {
      await pumpComponent(tester, PlaceTile(place: lugar, hero: false));
      expect(find.text('850M'), findsOneWidget);
    });

    testWidgets('sem distância, não inventa "0M"', (tester) async {
      final semGps = PlaceModel(
        id: 'p2',
        nome: 'Bar do Zé',
        nivelMovimento: 2,
        categoria: 'Bar',
        avaliacao: 0,
        nivelPrecoMedio: '',
        bio: '',
        endereco: '',
        distribuicao: const [],
        qtdAvaliacoes: 0,
      );

      await pumpComponent(tester, PlaceTile(place: semGps, hero: false));

      expect(find.text('0M'), findsNothing);
      // Nota 0 também não vira estrela: dado ausente não é dado ruim.
      expect(find.textContaining('★'), findsNothing);
    });
  });

  group('MovimentoIndicator', () {
    testWidgets('comunica o nível por texto, não só por cor', (tester) async {
      await pumpComponent(tester, const MovimentoIndicator(nivel: 5));
      expect(find.text('LOTADO'), findsOneWidget);

      await pumpComponent(tester, const MovimentoIndicator(nivel: 2));
      expect(find.text('TRANQUILO'), findsOneWidget);
    });

    test('sem leitura de movimento, diz que não há dado', () {
      expect(MovimentoIndicator.labelFor(0), 'SEM DADO');
    });
  });

  group('VibesterButton', () {
    testWidgets('dispara o toque quando habilitado', (tester) async {
      var toques = 0;
      await pumpComponent(
        tester,
        VibesterButton(label: 'Vou nessa', onPressed: () => toques++),
        width: 280,
      );

      await tester.tap(find.text('Vou nessa'));
      await tester.pump();

      expect(toques, 1);
    });

    testWidgets('não dispara quando onPressed é nulo', (tester) async {
      await pumpComponent(
        tester,
        const VibesterButton(label: 'Publicar', onPressed: null),
        width: 280,
      );

      await tester.tap(find.text('Publicar'));
      await tester.pump();
      expect(tester.takeException(), isNull);
    });

    testWidgets('em loading mostra indicador e ignora toque', (tester) async {
      var toques = 0;
      await pumpComponent(
        tester,
        VibesterButton(
          label: 'Entrar',
          state: VibesterButtonState.loading,
          onPressed: () => toques++,
        ),
        width: 280,
      );

      expect(find.byType(CircularProgressIndicator), findsOneWidget);
      await tester.tap(find.byType(VibesterButton));
      await tester.pump();
      expect(toques, 0);
    });

    testWidgets('em sucesso troca o rótulo e mostra o check', (tester) async {
      await pumpComponent(
        tester,
        VibesterButton(
          label: 'Seguir',
          successLabel: 'Seguindo',
          state: VibesterButtonState.success,
          onPressed: () {},
        ),
        width: 280,
      );
      await tester.pump(const Duration(milliseconds: 300));

      expect(find.text('Seguindo'), findsOneWidget);
      expect(find.byIcon(Icons.check_rounded), findsOneWidget);
    });

    testWidgets('tem alvo de toque de pelo menos 44px', (tester) async {
      await pumpComponent(
        tester,
        VibesterButton(label: 'Ok', onPressed: () {}, compact: true),
        width: 280,
      );

      final altura = tester.getSize(find.byType(VibesterButton)).height;
      expect(altura, greaterThanOrEqualTo(44));
    });
  });

  group('VibesterChip', () {
    testWidgets('alterna seleção e mantém alvo de 44px', (tester) async {
      var selecionado = false;

      await pumpComponent(
        tester,
        StatefulBuilder(
          builder: (context, setState) => VibesterChip(
            label: 'Bares',
            emoji: '🍺',
            selected: selecionado,
            onTap: () => setState(() => selecionado = !selecionado),
          ),
        ),
      );

      expect(tester.getSize(find.byType(VibesterChip)).height, 44);

      await tester.tap(find.text('Bares'));
      await tester.pump(const Duration(milliseconds: 200));
      expect(selecionado, isTrue);
    });
  });

  group('VibesterTag', () {
    testWidgets('sempre exibe em caixa alta', (tester) async {
      await pumpComponent(tester, const VibesterTag('perto de você'));
      expect(find.text('PERTO DE VOCÊ'), findsOneWidget);
    });
  });

  group('VibesterState', () {
    testWidgets('vazio diz o que houve e o que fazer', (tester) async {
      var tentou = 0;

      await pumpComponent(
        tester,
        VibesterState(
          headline: 'Hoje tá quieto',
          message: 'Nenhum evento marcado pra hoje ainda.',
          actionLabel: 'Tentar de novo',
          onAction: () => tentou++,
        ),
      );

      // Manchete em caixa alta, mensagem explicando, ação disponível.
      expect(find.text('HOJE TÁ QUIETO'), findsOneWidget);
      expect(find.textContaining('Nenhum evento marcado'), findsOneWidget);

      await tester.tap(find.text('Tentar de novo'));
      await tester.pump();
      expect(tentou, 1);
    });

    testWidgets('erro traz a mensagem tratada, nunca a exceção crua', (
      tester,
    ) async {
      await pumpComponent(
        tester,
        const VibesterState.error(
          message: 'Não foi possível carregar os eventos',
        ),
      );

      expect(find.text('DEU RUIM'), findsOneWidget);
      expect(find.text('Não foi possível carregar os eventos'), findsOneWidget);
      expect(find.textContaining('DioException'), findsNothing);
      expect(find.textContaining('Exception:'), findsNothing);
    });
  });

  group('VibesterNavbar', () {
    const destinos = [
      NavbarDestination(
        icon: Icons.bolt_outlined,
        activeIcon: Icons.bolt,
        label: 'HOJE',
      ),
      NavbarDestination(
        icon: Icons.explore_outlined,
        activeIcon: Icons.explore,
        label: 'EXPLORAR',
      ),
      NavbarDestination(
        icon: Icons.dynamic_feed_outlined,
        activeIcon: Icons.dynamic_feed,
        label: 'FEED',
      ),
      NavbarDestination(
        icon: Icons.person_outline_rounded,
        activeIcon: Icons.person_rounded,
        label: 'VOCÊ',
      ),
    ];

    testWidgets('mostra o rótulo apenas do destino ativo', (tester) async {
      await pumpComponent(
        tester,
        VibesterNavbar(
          destinations: destinos,
          currentIndex: 0,
          onDestinationSelected: (_) {},
          onCreate: () {},
        ),
        size: TestScreens.small,
      );
      await tester.pump(const Duration(milliseconds: 700));

      expect(find.text('HOJE'), findsOneWidget);
      expect(find.text('EXPLORAR'), findsNothing);
      expect(find.text('FEED'), findsNothing);
    });

    testWidgets('avisa qual destino foi tocado', (tester) async {
      int? selecionado;

      await pumpComponent(
        tester,
        VibesterNavbar(
          destinations: destinos,
          currentIndex: 0,
          onDestinationSelected: (i) => selecionado = i,
          onCreate: () {},
        ),
        size: TestScreens.small,
      );

      await tester.tap(find.byIcon(Icons.person_outline_rounded));
      await tester.pump();
      expect(selecionado, 3);
    });

    testWidgets('o botão central chama a ação de publicar', (tester) async {
      var criou = 0;

      await pumpComponent(
        tester,
        VibesterNavbar(
          destinations: destinos,
          currentIndex: 0,
          onDestinationSelected: (_) {},
          onCreate: () => criou++,
        ),
        size: TestScreens.small,
      );

      // Busca pelo tipo e não pelo ícone: a ação é "publicar", e o desenho
      // do ícone pode mudar sem que o contrato mude.
      await tester.tap(find.byType(NavbarCenterAction));
      await tester.pump(const Duration(milliseconds: 300));
      expect(criou, 1);
    });

    testWidgets('mostra o contador de não lidas no destino indicado', (
      tester,
    ) async {
      await pumpComponent(
        tester,
        VibesterNavbar(
          destinations: destinos,
          currentIndex: 0,
          onDestinationSelected: (_) {},
          badgeIndex: 3,
          badgeCount: 7,
        ),
        size: TestScreens.small,
      );

      expect(find.text('7'), findsOneWidget);
    });

    testWidgets('renderiza nos três tamanhos de tela', (tester) async {
      for (final size in TestScreens.all.values) {
        await pumpComponent(
          tester,
          VibesterNavbar(
            destinations: destinos,
            currentIndex: 1,
            onDestinationSelected: (_) {},
            onCreate: () {},
          ),
          size: size,
        );
        await tester.pump(const Duration(milliseconds: 700));
        expect(tester.takeException(), isNull);
      }
    });

    testWidgets('o botão central fica inteiro dentro da barra', (tester) async {
      await pumpComponent(
        tester,
        VibesterNavbar(
          destinations: destinos,
          currentIndex: 0,
          onDestinationSelected: (_) {},
          onCreate: () {},
        ),
        size: TestScreens.small,
      );
      await tester.pump(const Duration(milliseconds: 700));

      // O botão vive dentro da barra, não apoiado sobre ela: precisa caber
      // na altura do fundo de vidro, e não só na caixa externa do widget.
      final barra = tester.getRect(find.byType(NavbarBackground));
      final botao = tester.getRect(find.byType(NavbarCenterAction));

      expect(botao.top, greaterThanOrEqualTo(barra.top - 0.5));
      expect(botao.bottom, lessThanOrEqualTo(barra.bottom + 0.5));
      expect(botao.left, greaterThanOrEqualTo(barra.left - 0.5));
      expect(botao.right, lessThanOrEqualTo(barra.right + 0.5));
    });

    testWidgets('cada destino tem alvo de toque de pelo menos 44px', (
      tester,
    ) async {
      await pumpComponent(
        tester,
        VibesterNavbar(
          destinations: destinos,
          currentIndex: 0,
          onDestinationSelected: (_) {},
          onCreate: () {},
        ),
        size: TestScreens.small,
      );
      await tester.pump(const Duration(milliseconds: 700));

      final itens = find.byType(NavbarItem);
      expect(itens, findsNWidgets(destinos.length));

      for (var i = 0; i < destinos.length; i++) {
        final size = tester.getSize(itens.at(i));
        expect(
          size.height,
          greaterThanOrEqualTo(NavbarTokens.minTouchTarget),
          reason: 'alvo baixo em ${destinos[i].label}',
        );
        expect(
          size.width,
          greaterThanOrEqualTo(NavbarTokens.minTouchTarget),
          reason: 'alvo estreito em ${destinos[i].label}',
        );
      }
    });

    testWidgets('esconde e devolve a barra sem quebrar', (tester) async {
      Widget navbar(bool visivel) => VibesterNavbar(
        destinations: destinos,
        currentIndex: 0,
        onDestinationSelected: (_) {},
        onCreate: () {},
        visible: visivel,
      );

      await pumpComponent(tester, navbar(true), size: TestScreens.small);
      await tester.pump(const Duration(milliseconds: 700));

      await pumpComponent(tester, navbar(false), size: TestScreens.small);
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.takeException(), isNull);

      await pumpComponent(tester, navbar(true), size: TestScreens.small);
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.takeException(), isNull);
    });

    testWidgets('sem ação central, a barra é só a fileira de destinos', (
      tester,
    ) async {
      await pumpComponent(
        tester,
        VibesterNavbar(
          destinations: destinos,
          currentIndex: 0,
          onDestinationSelected: (_) {},
        ),
        size: TestScreens.small,
      );
      await tester.pump(const Duration(milliseconds: 700));

      expect(find.byType(NavbarCenterAction), findsNothing);
      expect(tester.takeException(), isNull);
    });

    testWidgets('expõe cada destino à acessibilidade, com estado', (
      tester,
    ) async {
      // Habilita a árvore de semântica: sem isso os finders semânticos não
      // enxergam nada, e o próprio leitor de tela não teria o que ler.
      final semantica = tester.ensureSemantics();

      await pumpComponent(
        tester,
        VibesterNavbar(
          destinations: destinos,
          currentIndex: 2,
          onDestinationSelected: (_) {},
          onCreate: () {},
        ),
        size: TestScreens.small,
      );
      await tester.pump(const Duration(milliseconds: 700));

      for (final destino in destinos) {
        expect(
          find.bySemanticsLabel(destino.label),
          findsOneWidget,
          reason: '${destino.label} sem rótulo acessível',
        );
      }
      expect(find.bySemanticsLabel('Publicar'), findsOneWidget);

      // O destino ativo precisa se anunciar como selecionado — estado não
      // pode depender só do âmbar. E o rótulo aparece uma vez só: o texto
      // visível do item ativo é excluído da semântica para o leitor de tela
      // não ler "FEED, FEED".
      final ativo = tester.getSemantics(find.bySemanticsLabel('FEED'));
      expect(ativo.label, 'FEED');
      expect(ativo.hasFlag(SemanticsFlag.isButton), isTrue);
      expect(ativo.hasFlag(SemanticsFlag.isSelected), isTrue);
      expect(ativo.getSemanticsData().hasAction(SemanticsAction.tap), isTrue);

      // E o inativo não se anuncia como selecionado.
      final inativo = tester.getSemantics(find.bySemanticsLabel('HOJE'));
      expect(inativo.hasFlag(SemanticsFlag.isSelected), isFalse);

      semantica.dispose();
    });
  });

  group('formatHandle', () {
    test('garante exatamente um @', () {
      expect(formatHandle('anavibes'), '@anavibes');
      expect(formatHandle('@anavibes'), '@anavibes');
      expect(formatHandle('@@anavibes'), '@anavibes');
      expect(formatHandle('  @anavibes '), '@anavibes');
    });

    test('sem nome, devolve vazio para o call-site decidir o fallback', () {
      expect(formatHandle(null), '');
      expect(formatHandle(''), '');
      expect(formatHandle('@'), '');
    });
  });

  group('contraste de texto sobre as superfícies da paleta', () {
    // Acessibilidade (§56): o texto primário precisa de contraste real sobre
    // o fundo do app nos dois temas. 4.5:1 é o mínimo da WCAG para corpo.
    double luminanciaRelativa(Color c) => c.computeLuminance();

    double razao(Color a, Color b) {
      final l1 = luminanciaRelativa(a);
      final l2 = luminanciaRelativa(b);
      final claro = l1 > l2 ? l1 : l2;
      final escuro = l1 > l2 ? l2 : l1;
      return (claro + 0.05) / (escuro + 0.05);
    }

    test('texto primário sobre o fundo passa em 4.5:1 nos dois temas', () {
      expect(
        razao(AppColors.dark.textPrimary, AppColors.dark.noturno),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        razao(AppColors.light.textPrimary, AppColors.light.noturno),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('texto secundário sobre o fundo passa em 4.5:1 nos dois temas', () {
      expect(
        razao(AppColors.dark.textSecondary, AppColors.dark.noturno),
        greaterThanOrEqualTo(4.5),
      );
      expect(
        razao(AppColors.light.textSecondary, AppColors.light.noturno),
        greaterThanOrEqualTo(4.5),
      );
    });

    test('onFill devolve texto legível sobre todo preenchimento sólido', () {
      // Este é o teste que pegou o problema real: branco sobre âmbar dava
      // 2,47:1 e era o rótulo de todo botão principal do app.
      for (final tema in [AppColors.dark, AppColors.light]) {
        for (final fundo in [tema.ambar, tema.brasa, tema.error]) {
          expect(
            razao(tema.onFill(fundo), fundo),
            greaterThanOrEqualTo(4.5),
            reason: 'contraste insuficiente sobre $fundo',
          );
        }
      }
    });

    test('sobre âmbar, a escolha é a tinta escura, não o branco', () {
      expect(AppColors.dark.onAmbar, AppColors.ink);
      expect(AppColors.dark.onBrasa, AppColors.ink);
    });
  });
}
