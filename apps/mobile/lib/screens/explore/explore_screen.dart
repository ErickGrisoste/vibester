import 'dart:async';

import 'package:diacritic/diacritic.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/utils/search_state.dart';
import 'package:mobile/utils/username.dart';
import 'package:mobile/widgets/cards/event/event_poster_card.dart';
import 'package:mobile/widgets/cards/place/place_tile.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_search_field.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/common/vibester_tag.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
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
  State<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends State<ExploreScreen> {
  final _controller = TextEditingController();
  final _userService = UserService();

  Timer? _debounce;
  String _query = '';
  _ResultTab _tab = _ResultTab.places;

  List<UserSearchResult> _users = [];
  bool _loadingUsers = false;
  String? _usersError;

  /// Categorias com imagem de capa (assets do produto). Os rótulos batem com
  /// `PlaceModel.categoria` vindo da API, que é o que permite filtrar.
  static const _categories = [
    ('Balada', 'assets/img/baladas.jpg'),
    ('Bar', 'assets/img/bares.jpg'),
    ('Restaurantes', 'assets/img/restaurantes.jpg'),
    ('Lounges', 'assets/img/lounges.jpg'),
    ('Eventos', 'assets/img/eventos.jpg'),
    ('Entretenimento', 'assets/img/entretenimento.jpg'),
  ];

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
      if (!mounted) return;
      setState(() {
        _users = results;
        _loadingUsers = false;
        _usersError = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loadingUsers = false;
        _usersError = 'Não foi possível buscar pessoas agora';
      });
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

  Widget _buildDiscovery(BuildContext context, PlaceListProvider provider) {
    final colors = context.colors;
    final trending =
        provider.places.where((p) => p.nivelMovimento >= 4).toList()
          ..sort((a, b) => b.nivelMovimento.compareTo(a.nivelMovimento));

    return ListView(
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
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: AppSpacing.screen),
          child: Column(
            children: [
              _CategoryBlock(
                label: _categories.first.$1,
                image: _categories.first.$2,
                height: 150,
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
                            onTap: () => _searchFor(_categories[i + 1].$1),
                          ),
                        ),
                      ],
                    ],
                  ),
                ),
            ],
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
    if (_users.isEmpty) return const _EmptyTab(what: 'pessoa');

    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.sm,
        AppSpacing.screen,
        AppSpacing.dockGap,
      ),
      itemCount: _users.length,
      itemBuilder: (context, i) => StaggeredEntrance(
        index: i,
        child: _UserRow(user: _users[i]),
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
  final VoidCallback onTap;

  const _CategoryBlock({
    required this.label,
    required this.image,
    required this.height,
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
                  child: Text(
                    label.toUpperCase(),
                    style: context.typography.headlineMedium.copyWith(
                      color: Colors.white,
                    ),
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

class _UserRow extends StatelessWidget {
  final UserSearchResult user;

  const _UserRow({required this.user});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return VibesterPressable(
      onTap: () => Navigator.pushNamed(
        context,
        AppRoutes.otherProfile,
        arguments: user.accountId,
      ),
      borderRadius: AppRadius.mdAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Row(
          children: [
            ClipOval(
              child: SizedBox(
                width: 48,
                height: 48,
                child: VibesterImage(
                  source: user.avatarUrl ?? '',
                  placeholderIcon: Icons.person_outline_rounded,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.name?.isNotEmpty == true
                        ? user.name!
                        : (user.username ?? 'Usuário'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.typography.titleMedium.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (formatHandle(user.username).isNotEmpty)
                        formatHandle(user.username),
                      '${user.followers} SEGUINDO ELE',
                    ].join('  ·  '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.typography.monoSmall.copyWith(
                      color: colors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_outward_rounded,
              size: 18,
              color: colors.textDisabled,
            ),
          ],
        ),
      ),
    );
  }
}
