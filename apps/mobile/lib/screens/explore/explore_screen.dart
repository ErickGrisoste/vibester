import 'dart:async';
import 'dart:math' as math;

import 'package:diacritic/diacritic.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/models/place/place_category_covers.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/utils/search_state.dart';
import 'package:mobile/widgets/cards/event/event_poster_card.dart';
import 'package:mobile/widgets/cards/place/place_tile.dart';
import 'package:mobile/widgets/cards/users/user_row.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_search_field.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/common/vibester_tag.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:mobile/providers/safety/block_provider.dart';
import 'package:provider/provider.dart';

/// EXPLORAR — busca e descoberta ativa.
///
/// A tela tem dois modos, e a diferença entre eles é o que o usuário já sabe:
///
/// * **Sem termo digitado** ele não sabe o que procura, então a tela oferece
///   caminhos: um mosaico de categorias com foto (blocos de tamanhos
///   diferentes, porque nem toda categoria tem o mesmo peso), o que ele
///   buscou antes, e o que está bombando agora.
/// * **Com termo digitado** ele sabe, então a tela some com tudo isso e vira
///   resultado puro, separado por tipo (lugares, rolês, pessoas) com a
///   contagem real de cada aba — sem "0 resultados" escondido atrás de uma
///   aba que o usuário precisaria adivinhar.
///
/// Lugares e eventos são filtrados sobre o que os providers já têm em
/// memória (ida à rede a cada tecla deixaria a busca lenta no exato momento
/// em que ela precisa parecer instantânea); pessoas vão à API com debounce de
/// 300ms, porque não há lista de usuários carregada localmente.
class ExploreScreen extends StatefulWidget {
  const ExploreScreen({super.key});

  @override
  State<ExploreScreen> createState() => ExploreScreenState();
}

class ExploreScreenState extends State<ExploreScreen> {
  final _controller = TextEditingController();

  /// Rolagem do modo descoberta, para o reset voltar ao topo.
  final _discoveryScroll = ScrollController();
  final _userService = UserService();

  Timer? _debounce;
  String _query = '';
  _ResultTab _tab = _ResultTab.places;

  List<UserSearchResult> _users = [];
  bool _loadingUsers = false;
  String? _usersError;

  /// Categorias com imagem de capa — ver `placeCategoryCovers`.
  static const _categories = placeCategoryCovers;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<PlaceListProvider>().fetchPlaces();
      context.read<EventsListProvider>().fetchEvents();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _controller.dispose();
    _discoveryScroll.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    final query = value.trim();
    setState(() => _query = query);

    _debounce?.cancel();
    if (query.isEmpty) {
      setState(() {
        _users = [];
        _loadingUsers = false;
        _usersError = null;
      });
      return;
    }

    setState(() => _loadingUsers = true);
    _debounce = Timer(
      const Duration(milliseconds: 300),
      () => _findUsers(query),
    );
  }

  Future<void> _findUsers(String query) async {
    try {
      final results = await _userService.searchUsers(query);
      // Resposta de um termo que já não está na tela (a pessoa apagou,
      // trocou ou resetou a busca no meio do caminho): descarta.
      if (!mounted || query != _query) return;
      setState(() {
        _users = results;
        _loadingUsers = false;
        _usersError = null;
      });
    } catch (_) {
      if (!mounted || query != _query) return;
      setState(() {
        _loadingUsers = false;
        _usersError = 'Não foi possível buscar pessoas agora';
      });
    }
  }

  /// Chamado pela casca da Home quando o usuário toca em BUSCA estando nela:
  /// limpa o termo, fecha o teclado e devolve a tela à descoberta, no topo.
  void resetTab() {
    _debounce?.cancel();
    FocusManager.instance.primaryFocus?.unfocus();

    final hadQuery = _query.isNotEmpty;
    _controller.clear();
    setState(() {
      _query = '';
      _tab = _ResultTab.places;
      _users = [];
      _loadingUsers = false;
      _usersError = null;
    });

    // Com termo digitado a descoberta nem está montada: ela volta já no
    // topo. Sem termo, a lista está na tela e sobe animada.
    if (!hadQuery && _discoveryScroll.hasClients) {
      _discoveryScroll.animateTo(
        0,
        duration: AppMotion.slow,
        curve: AppMotion.standard,
      );
    }
  }

  void _remember(String term) {
    if (term.isEmpty) return;
    ultimasPesquisas
      ..remove(term)
      ..insert(0, term);
    if (ultimasPesquisas.length > 6) ultimasPesquisas.removeLast();
  }

  void _searchFor(String term) {
    _controller.text = term;
    _controller.selection = TextSelection.collapsed(offset: term.length);
    _onQueryChanged(term);
    _remember(term);
  }

  static bool _matches(String haystack, String needle) => removeDiacritics(
    haystack.toLowerCase(),
  ).contains(removeDiacritics(needle.toLowerCase()));

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final placesProvider = context.watch<PlaceListProvider>();
    final eventsProvider = context.watch<EventsListProvider>();

    final places = _query.isEmpty
        ? const <PlaceModel>[]
        : placesProvider.places
              .where(
                (p) =>
                    _matches(p.nome, _query) ||
                    _matches(p.categoria, _query) ||
                    _matches(p.endereco, _query),
              )
              .toList();

    // O `..sort` precisa ficar dentro do ramo que produz a lista nova: numa
    // cascata depois do ternário ele cairia sobre a lista `const` do ramo
    // vazio, que é imutável — `Cannot modify an unmodifiable list` na
    // primeira montagem da tela.
    final events = _query.isEmpty
        ? const <EventModel>[]
        : (eventsProvider.events
              .where(
                (e) =>
                    e.isUpcoming &&
                    (_matches(e.titulo, _query) ||
                        _matches(e.categoria, _query) ||
                        _matches(e.artistas, _query) ||
                        _matches(e.localizacao, _query)),
              )
              .toList()
            ..sort((a, b) => a.dataDoEvento.compareTo(b.dataDoEvento)));

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.screen,
                AppSpacing.md,
                AppSpacing.screen,
                AppSpacing.lg,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'EXPLORAR',
                    style: context.typography.displayLarge.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.lg),
                  VibesterSearchField(
                    controller: _controller,
                    onChanged: _onQueryChanged,
                    onSubmitted: _remember,
                  ),
                ],
              ),
            ),
            Expanded(
              child: _query.isEmpty
                  ? _buildDiscovery(context, placesProvider)
                  : _buildResults(context, places, events),
            ),
          ],
        ),
      ),
    );
  }

  // -------------------------------------------------------------------
  // Modo descoberta
  // -------------------------------------------------------------------

  /// TAMANHO DOS RÓTULOS: um tamanho de fonte só para os nomes das seis
  /// categorias, o maior em que **todos** cabem numa linha neste aparelho.
  ///
  /// O nome não quebra mais de linha. Antes, num aparelho mais estreito ou
  /// com a fonte do sistema aumentada, um nome comprido ("ENTRETENIMENTO",
  /// "RESTAURANTES") descia para a linha de baixo — às vezes partido no meio
  /// da palavra — e só aquele bloco ficava torto. Não há como saber de
  /// antemão qual nome estoura em qual aparelho, então a conta é feita aqui,
  /// com a largura real do mosaico:
  ///
  /// 1. mede cada nome no tamanho normal (o `headlineMedium`), com a mesma
  ///    fonte e a mesma escala de texto do sistema que o `Text` vai usar;
  /// 2. compara com a largura útil do bloco dele (bloco inteiro ou metade);
  /// 3. o nome mais apertado define a redução, e ela vale para os seis — os
  ///    nomes ficam sempre do mesmo tamanho entre si.
  ///
  /// Onde tudo cabe, nada muda: volta o tamanho normal de sempre.
  ///
  /// [mosaicWidth] é a largura do mosaico já sem as margens da tela. As
  /// larguras dos blocos seguem a montagem do mosaico no `build`: o primeiro
  /// ocupa a linha inteira, os demais vão em pares, e um que sobre sozinho no
  /// fim também ocupa a linha inteira.
  double _categoryLabelSize(BuildContext context, double mosaicWidth) {
    final base = context.typography.headlineMedium;
    final baseSize = base.fontSize!;

    // O `Text` herda do `DefaultTextStyle` o que o estilo não diz (a família
    // da fonte, por exemplo). A medida precisa herdar igual, ou mede uma
    // fonte e desenha outra.
    final style = DefaultTextStyle.of(context).style.merge(base);
    final textScaler = MediaQuery.textScalerOf(context);
    final textDirection = Directionality.of(context);

    // Largura útil do texto: o bloco menos o respiro interno dos dois lados.
    const padding = AppSpacing.md * 2;
    final full = mosaicWidth - padding;
    final half = (mosaicWidth - AppSpacing.md) / 2 - padding;

    var scale = 1.0;
    for (var i = 0; i < _categories.length; i++) {
      final alone = i == 0 || (i.isOdd && i + 1 >= _categories.length);
      final available = alone ? full : half;

      final painter = TextPainter(
        text: TextSpan(text: _categories[i].$1.toUpperCase(), style: style),
        textDirection: textDirection,
        textScaler: textScaler,
        maxLines: 1,
      )..layout();
      final width = painter.width;
      painter.dispose();

      if (width > available && available > 0) {
        scale = math.min(scale, available / width);
      }
    }

    if (scale >= 1) return baseSize;

    // Folga de 3% ao reduzir: arredondamento de subpixel não pode fazer o
    // nome mais comprido estourar por um fio.
    return baseSize * scale * 0.97;
  }

  Widget _buildDiscovery(BuildContext context, PlaceListProvider provider) {
    final colors = context.colors;
    final trending =
        provider.places.where((p) => p.nivelMovimento >= 4).toList()
          ..sort((a, b) => b.nivelMovimento.compareTo(a.nivelMovimento));

    return ListView(
      controller: _discoveryScroll,
      padding: const EdgeInsets.only(bottom: AppSpacing.dockGap),
      children: [
        if (ultimasPesquisas.isNotEmpty) ...[
          _MiniHeader(label: 'VOCÊ BUSCOU'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screen),
            child: Wrap(
              spacing: AppSpacing.sm,
              runSpacing: AppSpacing.sm,
              children: [
                for (final term in ultimasPesquisas)
                  VibesterPressable(
                    onTap: () => _searchFor(term),
                    borderRadius: AppRadius.stickerAll,
                    child: VibesterTag(
                      term,
                      tone: TagTone.outline,
                      icon: Icons.history_rounded,
                    ),
                  ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
        ],

        _MiniHeader(label: 'TIPO DE ROLÊ'),
        // Mosaico assimétrico: a primeira categoria ocupa a largura toda e as
        // demais vão em pares. Não é decoração — é hierarquia: quem chega sem
        // saber o que quer olha primeiro pro bloco maior.
        //
        // TAMANHO DOS RÓTULOS: o `LayoutBuilder` dá a largura real do mosaico
        // neste aparelho, e com ela se calcula um tamanho de fonte único para
        // os seis nomes (ver [_categoryLabelSize]).
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screen),
          child: LayoutBuilder(
            builder: (context, constraints) {
              final labelSize = _categoryLabelSize(
                context,
                constraints.maxWidth,
              );

              return Column(
                children: [
                  _CategoryBlock(
                    label: _categories.first.$1,
                    image: _categories.first.$2,
                    height: 150,
                    labelSize: labelSize,
                    onTap: () => _searchFor(_categories.first.$1),
                  ),
                  const SizedBox(height: AppSpacing.md),
                  for (var i = 1; i < _categories.length; i += 2)
                    Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.md),
                      child: Row(
                        children: [
                          Expanded(
                            child: _CategoryBlock(
                              label: _categories[i].$1,
                              image: _categories[i].$2,
                              height: 118,
                              labelSize: labelSize,
                              onTap: () => _searchFor(_categories[i].$1),
                            ),
                          ),
                          if (i + 1 < _categories.length) ...[
                            const SizedBox(width: AppSpacing.md),
                            Expanded(
                              child: _CategoryBlock(
                                label: _categories[i + 1].$1,
                                image: _categories[i + 1].$2,
                                height: 118,
                                labelSize: labelSize,
                                onTap: () =>
                                    _searchFor(_categories[i + 1].$1),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                ],
              );
            },
          ),
        ),

        if (trending.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          _MiniHeader(label: 'CHEIO AGORA'),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screen),
            child: Column(
              children: [
                for (final (i, place) in trending.take(4).indexed)
                  StaggeredEntrance(
                    index: i,
                    child: PlaceTile(place: place, hero: false),
                  ),
              ],
            ),
          ),
        ] else if (provider.isLoading) ...[
          const SizedBox(height: AppSpacing.xl),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: AppSpacing.screen),
            child: VibesterSkeletonLines(lines: 3),
          ),
        ],

        const SizedBox(height: AppSpacing.xl),
        Center(
          child: Text(
            'OU DIGITA O QUE VOCÊ QUER  ↑',
            style: context.typography.monoMicro.copyWith(
              color: colors.textDisabled,
            ),
          ),
        ),
      ],
    );
  }

  // -------------------------------------------------------------------
  // Modo resultado
  // -------------------------------------------------------------------

  Widget _buildResults(
    BuildContext context,
    List<PlaceModel> places,
    List<EventModel> events,
  ) {
    final counts = {
      _ResultTab.places: places.length,
      _ResultTab.events: events.length,
      _ResultTab.people: _users.length,
    };

    final total = counts.values.fold(0, (a, b) => a + b);
    if (total == 0 && !_loadingUsers) {
      return VibesterState(
        headline: 'Nada com esse nome',
        message:
            'Não achamos "$_query" em lugares, rolês ou pessoas. Tenta um '
            'termo mais curto, ou busca pela categoria.',
        icon: Icons.search_off_rounded,
        illustration: Theme.of(context).brightness == Brightness.light
            ? 'assets/img/mascote/lupa.png'
            : 'assets/img/mascote/lupa.png',
      );
    }

    return Column(
      children: [
        _ResultTabs(
          selected: _tab,
          counts: counts,
          onSelected: (tab) => setState(() => _tab = tab),
        ),
        Expanded(
          child: switch (_tab) {
            _ResultTab.places => _placeResults(places),
            _ResultTab.events => _eventResults(events),
            _ResultTab.people => _peopleResults(context),
          },
        ),
      ],
    );
  }

  Widget _placeResults(List<PlaceModel> places) {
    if (places.isEmpty) return const _EmptyTab(what: 'lugar');
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.sm,
        AppSpacing.screen,
        AppSpacing.dockGap,
      ),
      itemCount: places.length,
      itemBuilder: (context, i) => StaggeredEntrance(
        index: i,
        child: PlaceTile(place: places[i], hero: false),
      ),
    );
  }

  Widget _eventResults(List<EventModel> events) {
    if (events.isEmpty) return const _EmptyTab(what: 'rolê');
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.sm,
        AppSpacing.screen,
        AppSpacing.dockGap,
      ),
      itemCount: events.length,
      itemBuilder: (context, i) => StaggeredEntrance(
        index: i,
        child: EventPosterCard(
          event: events[i],
          variant: EventCardVariant.wide,
          hero: false,
        ),
      ),
    );
  }

  Widget _peopleResults(BuildContext context) {
    if (_loadingUsers) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.screen),
        child: VibesterSkeletonLines(lines: 4, spacing: AppSpacing.lg),
      );
    }
    if (_usersError != null) {
      return VibesterState.error(
        message: _usersError!,
        onAction: () => _findUsers(_query),
      );
    }
    final blocks = context.watch<BlockProvider>();
    final users = _users.where((u) => !blocks.isBlocked(u.accountId)).toList();
    if (users.isEmpty) return const _EmptyTab(what: 'pessoa');

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.sm,
        AppSpacing.screen,
        AppSpacing.dockGap,
      ),
      itemCount: users.length,
      itemBuilder: (context, i) => StaggeredEntrance(
        index: i,
        child: UserRow(
          accountId: users[i].accountId,
          nome: users[i].name,
          nomeUsuario: users[i].username,
          fotoPerfil: users[i].avatarUrl,
          seguidores: users[i].followers,
        ),
      ),
    );
  }
}

enum _ResultTab {
  places('LUGARES'),
  events('ROLÊS'),
  people('PESSOAS');

  const _ResultTab(this.label);
  final String label;
}

/// Abas de resultado. A contagem fica visível em todas ao mesmo tempo — o
/// usuário decide para onde ir sabendo o que há em cada lado.
class _ResultTabs extends StatelessWidget {
  final _ResultTab selected;
  final Map<_ResultTab, int> counts;
  final ValueChanged<_ResultTab> onSelected;

  const _ResultTabs({
    required this.selected,
    required this.counts,
    required this.onSelected,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screen),
      child: Row(
        children: [
          for (final tab in _ResultTab.values)
            Expanded(
              child: Semantics(
                button: true,
                selected: tab == selected,
                child: GestureDetector(
                  onTap: () => onSelected(tab),
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    height: 46,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      border: Border(
                        bottom: BorderSide(
                          color: tab == selected
                              ? colors.ambar
                              : colors.hairline,
                          width: tab == selected
                              ? AppStroke.marker
                              : AppStroke.hairline,
                        ),
                      ),
                    ),
                    child: Text(
                      '${tab.label}  ${counts[tab] ?? 0}',
                      style: context.typography.monoMicro.copyWith(
                        color: tab == selected
                            ? colors.textPrimary
                            : colors.textDisabled,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _EmptyTab extends StatelessWidget {
  final String what;

  const _EmptyTab({required this.what});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Text(
          'NENHUM $what ENCONTRADO'.toUpperCase(),
          textAlign: TextAlign.center,
          style: context.typography.monoSmall.copyWith(
            color: context.colors.textDisabled,
          ),
        ),
      ),
    );
  }
}

class _MiniHeader extends StatelessWidget {
  final String label;

  const _MiniHeader({required this.label});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.lg,
        AppSpacing.screen,
        AppSpacing.md,
      ),
      child: Text(
        label,
        style: context.typography.monoEyebrow.copyWith(
          color: context.colors.textMuted,
        ),
      ),
    );
  }
}

/// Bloco de categoria: foto tratada (escurecida e com grão) e o nome grande
/// por cima. Sem card, sem borda — a foto é o botão.
class _CategoryBlock extends StatelessWidget {
  final String label;
  final String image;
  final double height;

  /// TAMANHO DOS RÓTULOS: tamanho da fonte do nome, o mesmo nos seis blocos
  /// (calculado pela tela em `_categoryLabelSize`).
  final double labelSize;

  final VoidCallback onTap;

  const _CategoryBlock({
    required this.label,
    required this.image,
    required this.height,
    required this.labelSize,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return VibesterPressable(
      onTap: onTap,
      borderRadius: AppRadius.mdAll,
      child: ClipRRect(
        borderRadius: const BorderRadius.only(
          topLeft: Radius.circular(AppRadius.md),
          topRight: Radius.circular(AppRadius.md),
          bottomRight: Radius.circular(AppRadius.md),
        ),
        child: SizedBox(
          height: height,
          child: Stack(
            fit: StackFit.expand,
            children: [
              VibesterImage(source: image),
              const Grain(opacity: 0.08, density: 0.6),
              DecoratedBox(
                decoration: BoxDecoration(gradient: colors.photoScrim),
              ),
              Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Align(
                  alignment: Alignment.bottomLeft,
                  // TAMANHO DOS RÓTULOS: uma linha só, nunca quebra — o
                  // tamanho já vem calculado para caber.
                  child: Text(
                    label.toUpperCase(),
                    maxLines: 1,
                    softWrap: false,
                    style: _labelStyle(context),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  /// TAMANHO DOS RÓTULOS: o estilo de sempre (`headlineMedium` em branco),
  /// no tamanho recebido. O espaçamento entre letras encolhe junto: a conta
  /// do tamanho mediu o nome com o espaçamento normal, e só escalando os dois
  /// na mesma proporção o nome reduzido ocupa exatamente o previsto.
  TextStyle _labelStyle(BuildContext context) {
    final base = context.typography.headlineMedium;
    final ratio = labelSize / base.fontSize!;

    return base.copyWith(
      color: Colors.white,
      fontSize: labelSize,
      letterSpacing: (base.letterSpacing ?? 0) * ratio,
    );
  }
}