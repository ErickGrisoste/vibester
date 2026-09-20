import 'package:flutter/material.dart';
import 'package:mobile/models/user/follow_profile.dart';
import 'package:mobile/providers/safety/block_provider.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/users/user_row.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/vibester_chip.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:provider/provider.dart';

/// Qual lado da relação a tela está mostrando.
enum FollowTab {
  seguidores('SEGUIDORES'),
  seguindo('SEGUINDO');

  const FollowTab(this.label);

  final String label;
}

/// Argumentos da rota. Os totais vêm dos contadores que o usuário acabou de
/// tocar — são o dado real do perfil, então aparecem no chip sem custo de
/// rede; `null` quando quem abriu não os tem.
class FollowListArgs {
  final String accountId;
  final FollowTab tab;

  /// Nome do dono da lista, usado no título.
  final String? nome;
  final int? totalSeguidores;
  final int? totalSeguindo;

  const FollowListArgs({
    required this.accountId,
    required this.tab,
    this.nome,
    this.totalSeguidores,
    this.totalSeguindo,
  });
}

/// Quem segue um perfil e quem esse perfil segue.
///
/// Abre pelos contadores do perfil (o próprio e o dos outros), já no lado que
/// foi tocado, e alterna entre os dois sem sair da tela — cada lado guarda a
/// própria lista, então voltar para o que já carregou não refaz a busca.
///
/// A linha é a mesma da busca por pessoas (`UserRow`) e leva ao perfil, que é
/// o que se espera de uma lista de gente.
class FollowListScreen extends StatefulWidget {
  final String accountId;
  final FollowTab initialTab;
  final String? nome;
  final int? totalSeguidores;
  final int? totalSeguindo;

  /// Injetável para teste; em produção a tela cria o seu.
  final UserService? service;

  const FollowListScreen({
    super.key,
    required this.accountId,
    this.initialTab = FollowTab.seguidores,
    this.nome,
    this.totalSeguidores,
    this.totalSeguindo,
    this.service,
  });

  FollowListScreen.fromArgs(FollowListArgs args, {Key? key, UserService? service})
    : this(
        key: key,
        accountId: args.accountId,
        initialTab: args.tab,
        nome: args.nome,
        totalSeguidores: args.totalSeguidores,
        totalSeguindo: args.totalSeguindo,
        service: service,
      );

  @override
  State<FollowListScreen> createState() => _FollowListScreenState();
}

class _FollowListScreenState extends State<FollowListScreen> {
  late final UserService _service = widget.service ?? UserService();
  late FollowTab _tab = widget.initialTab;

  /// Só a aba visitada é montada: a outra não gasta uma requisição enquanto
  /// ninguém pediu por ela.
  late final Set<FollowTab> _visitadas = {widget.initialTab};

  int? _total(FollowTab tab) => switch (tab) {
    FollowTab.seguidores => widget.totalSeguidores,
    FollowTab.seguindo => widget.totalSeguindo,
  };

  void _selecionar(FollowTab tab) {
    if (tab == _tab) return;
    setState(() {
      _tab = tab;
      _visitadas.add(tab);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final titulo = widget.nome?.trim();

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            ScreenHeader(
              title: titulo == null || titulo.isEmpty ? 'Pessoas' : titulo,
              eyebrow: 'CONEXÕES',
              bottomSpacing: AppSpacing.sm,
            ),
            // Régua rolável, não uma Row fixa: com o total ao lado do rótulo,
            // "SEGUIDORES" e "SEGUINDO" não cabem lado a lado em tela estreita.
            VibesterChipRail(
              children: [
                for (final tab in FollowTab.values)
                  VibesterChip(
                    label: tab.label,
                    selected: tab == _tab,
                    count: _total(tab),
                    onTap: () => _selecionar(tab),
                  ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: IndexedStack(
                index: FollowTab.values.indexOf(_tab),
                children: [
                  for (final tab in FollowTab.values)
                    _visitadas.contains(tab)
                        ? _FollowList(
                            key: ValueKey(tab),
                            accountId: widget.accountId,
                            tab: tab,
                            service: _service,
                          )
                        : const SizedBox.shrink(),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Uma das duas listas. Paginação por cursor com scroll infinito: a lista de
/// seguidores de um perfil grande não cabe numa resposta só.
class _FollowList extends StatefulWidget {
  final String accountId;
  final FollowTab tab;
  final UserService service;

  const _FollowList({
    super.key,
    required this.accountId,
    required this.tab,
    required this.service,
  });

  @override
  State<_FollowList> createState() => _FollowListState();
}

class _FollowListState extends State<_FollowList> {
  final _scrollController = ScrollController();
  final List<FollowProfile> _perfis = [];

  String? _nextCursor;
  bool _carregando = true;
  bool _carregandoMais = false;
  String? _erro;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_aoRolar);
    _carregar();
  }

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  Future<FollowProfilesPage> _buscar({String? cursor}) => switch (widget.tab) {
    FollowTab.seguidores => widget.service.listFollowers(
      widget.accountId,
      cursor: cursor,
    ),
    FollowTab.seguindo => widget.service.listFollowing(
      widget.accountId,
      cursor: cursor,
    ),
  };

  void _aoRolar() {
    if (!_scrollController.hasClients) return;
    final posicao = _scrollController.position;
    // Carrega antes de o usuário chegar ao fim, para a lista não dar solavanco.
    if (posicao.pixels >= posicao.maxScrollExtent - 400) _carregarMais();
  }

  Future<void> _carregar() async {
    if (widget.accountId.isEmpty) {
      setState(() {
        _carregando = false;
        _erro = 'Perfil não identificado';
      });
      return;
    }

    setState(() {
      _carregando = true;
      _erro = null;
    });

    try {
      final pagina = await _buscar();
      if (!mounted) return;
      setState(() {
        _perfis
          ..clear()
          ..addAll(pagina.perfis);
        _nextCursor = pagina.nextCursor;
        _carregando = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _carregando = false;
        // Mensagem já tratada pelo service — nunca a DioException crua.
        _erro = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _carregarMais() async {
    final cursor = _nextCursor;
    if (cursor == null || _carregandoMais || _carregando) return;

    setState(() => _carregandoMais = true);
    try {
      final pagina = await _buscar(cursor: cursor);
      if (!mounted) return;
      setState(() {
        _perfis.addAll(pagina.perfis);
        _nextCursor = pagina.nextCursor;
      });
    } catch (e) {
      // Falha ao paginar não derruba o que já está na tela.
      debugPrint('Falha ao carregar mais ${widget.tab.label}: $e');
    } finally {
      if (mounted) setState(() => _carregandoMais = false);
    }
  }

  String get _mensagemVazia => switch (widget.tab) {
    FollowTab.seguidores =>
      'Quando alguém começar a seguir, aparece aqui.',
    FollowTab.seguindo =>
      'Ninguém seguido ainda. Procure gente em EXPLORAR.',
  };

  /// Estado vazio ou de erro dentro de um rolável: puxar para atualizar
  /// continua funcionando, e o bloco não estoura em tela baixa — abaixo do
  /// cabeçalho e dos chips sobra pouca altura num aparelho pequeno.
  Widget _estado(BuildContext context, Widget filho) {
    final colors = context.colors;

    return RefreshIndicator(
      color: colors.ambar,
      backgroundColor: colors.surface,
      onRefresh: _carregar,
      child: LayoutBuilder(
        builder: (context, constraints) => ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: filho,
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    if (_carregando) {
      return const Padding(
        padding: EdgeInsets.all(AppSpacing.screen),
        child: VibesterSkeletonLines(lines: 5, spacing: AppSpacing.lg),
      );
    }

    if (_erro != null) {
      return _estado(
        context,
        VibesterState.error(message: _erro!, onAction: _carregar),
      );
    }

    // Quem o usuário bloqueou não aparece em lista de gente nenhuma.
    final blocks = context.watch<BlockProvider>();
    final perfis = _perfis
        .where((perfil) => !blocks.isBlocked(perfil.accountId))
        .toList();

    if (perfis.isEmpty) {
      return _estado(
        context,
        VibesterState(
          headline: 'NINGUÉM AQUI',
          message: _mensagemVazia,
          icon: Icons.person_search_outlined,
        ),
      );
    }

    return RefreshIndicator(
      color: colors.ambar,
      backgroundColor: colors.surface,
      onRefresh: _carregar,
      child: ListView.builder(
        controller: _scrollController,
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.screen,
          AppSpacing.sm,
          AppSpacing.screen,
          AppSpacing.huge,
        ),
        itemCount: perfis.length + (_carregandoMais ? 1 : 0),
        itemBuilder: (context, i) {
          if (i >= perfis.length) {
            return const Padding(
              padding: EdgeInsets.symmetric(vertical: AppSpacing.lg),
              child: VibesterSkeletonLines(lines: 1),
            );
          }

          final perfil = perfis[i];
          return StaggeredEntrance(
            index: i,
            child: UserRow(
              accountId: perfil.accountId,
              nome: perfil.nome,
              nomeUsuario: perfil.nomeUsuario,
              fotoPerfil: perfil.fotoPerfil,
              seguidores: perfil.seguidores,
            ),
          );
        },
      ),
    );
  }
}
