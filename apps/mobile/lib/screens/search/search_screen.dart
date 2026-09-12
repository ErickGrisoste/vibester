import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/search_bar.dart';
import 'package:mobile/utils/search_state.dart';
import 'package:mobile/widgets/cards/place/place_card.dart';
import 'package:provider/provider.dart';

class SearchScreen extends StatefulWidget {
  const SearchScreen({super.key});

  @override
  State<SearchScreen> createState() => _SearchScreenState();
}

class _SearchScreenState extends State<SearchScreen> {
  final TextEditingController pesquisaController = TextEditingController();
  final UserService _userService = UserService();

  String? _categoriaSelecionada;
  List<String>? _historicoGuardado;

  List<UserSearchResult> _userResults = [];
  bool _isSearchingUsers = false;
  String? _searchError;
  Timer? _debounceTimer;

  static const _categorias = [
    {'label': 'Balada', 'image': 'assets/img/baladas.jpg'},
    {'label': 'Bar', 'image': 'assets/img/bares.jpg'},
    {'label': 'Lounges', 'image': 'assets/img/lounges.jpg'},
    {'label': 'Eventos', 'image': 'assets/img/eventos.jpg'},
    {'label': 'Restaurantes', 'image': 'assets/img/restaurantes.jpg'},
    {'label': 'Entretenimento', 'image': 'assets/img/entretenimento.jpg'},
  ];

  @override
  void dispose() {
    _debounceTimer?.cancel();
    pesquisaController.dispose();
    super.dispose();
  }

  void _onSearchChanged() {
    final query = pesquisaController.text.trim();

    _debounceTimer?.cancel();

    if (query.isEmpty) {
      setState(() {
        _userResults = [];
        _isSearchingUsers = false;
        _searchError = null;
      });
      return;
    }

    setState(() => _isSearchingUsers = true);

    _debounceTimer = Timer(const Duration(milliseconds: 300), () {
      _buscarUsuarios(query);
    });
  }

  Future<void> _buscarUsuarios(String q) async {
    try {
      final results = await _userService.searchUsers(q);
      if (!mounted) return;
      setState(() {
        _userResults = results;
        _isSearchingUsers = false;
        _searchError = null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _isSearchingUsers = false;
        _searchError = 'Não foi possível buscar usuários';
      });
    }
  }

  void _selecionarCategoria(String categoria) {
    setState(() {
      _categoriaSelecionada = categoria;
      pesquisaController.clear();
      _userResults = [];
      _historicoGuardado = List<String>.from(ultimasPesquisas);
      ultimasPesquisas.clear();
    });
    context.read<PlaceListProvider>().fetchPlaces();
  }

  void _voltarParaInicio() {
    setState(() {
      _categoriaSelecionada = null;
      if (_historicoGuardado != null) {
        ultimasPesquisas
          ..clear()
          ..addAll(_historicoGuardado!);
        _historicoGuardado = null;
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final screenWidth = MediaQuery.of(context).size.width;
    final provider = context.watch<PlaceListProvider>();
    final places = provider.places;
    final listaFiltrada = _categoriaSelecionada != null
        ? places
              .where(
                (p) =>
                    p.categoria.toLowerCase() ==
                    _categoriaSelecionada!.toLowerCase(),
              )
              .toList()
        : <PlaceModel>[];

    final buscandoUsuarios = pesquisaController.text.trim().isNotEmpty;

    return Scaffold(
      backgroundColor: context.colors.darkGrey,
      appBar: AppBar(
        backgroundColor: context.colors.navy,
        elevation: 0,
        centerTitle: true,
        automaticallyImplyLeading: false,
        title: Image.asset(
          'assets/img/logo/tipografia.png',
          height: 30,
          fit: BoxFit.contain,
        ),
      ),
      body: RefreshIndicator(
        color: context.colors.ambar,
        onRefresh: () async {
          if (_categoriaSelecionada != null) {
            await context.read<PlaceListProvider>().fetchPlaces(force: true);
          }
        },
        child: CustomScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          slivers: [
            SliverToBoxAdapter(
              child: Padding(
                padding: const EdgeInsets.only(
                  top: 20,
                  right: 16,
                  left: 16,
                  bottom: 20,
                ),
                child: CustomSearchBar(
                  controller: pesquisaController,
                  onChanged: _onSearchChanged,
                  onSubmitted: () {
                    final texto = pesquisaController.text.trim();
                    if (texto.isNotEmpty) {
                      setState(() {
                        ultimasPesquisas.insert(0, texto);
                        if (ultimasPesquisas.length > 5) {
                          ultimasPesquisas.removeLast();
                        }
                      });
                    }
                  },
                ),
              ),
            ),

            // Resultados de busca de usuários
            if (buscandoUsuarios) ...[
              if (_isSearchingUsers)
                SliverFillRemaining(
                  child: Center(
                    child: CircularProgressIndicator(
                      color: context.colors.ambar,
                    ),
                  ),
                )
              else if (_searchError != null)
                SliverFillRemaining(
                  child: Center(
                    child: Text(
                      _searchError!,
                      style: TextStyle(color: context.colors.textDisabled),
                    ),
                  ),
                )
              else if (_userResults.isEmpty)
                SliverFillRemaining(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      SizedBox(
                        height: 180,
                        width: 180,
                        child: Image.asset('assets/img/mascote/lupa.png'),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Nenhum usuário encontrado',
                        style: TextStyle(
                          color: context.colors.textDisabled,
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                )
              else ...[
                SliverToBoxAdapter(
                  child: Padding(
                    padding: const EdgeInsets.only(left: 16, bottom: 8),
                    child: Text(
                      'Usuários',
                      style: TextStyle(
                        color: context.colors.textPrimary,
                        fontSize: 20,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ),
                SliverPadding(
                  padding: const EdgeInsets.only(bottom: 80),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate((context, index) {
                      final user = _userResults[index];
                      return _UserSearchTile(
                        user: user,
                        onTap: () => Navigator.pushNamed(
                          context,
                          AppRoutes.otherProfile,
                          arguments: user.accountId,
                        ),
                      );
                    }, childCount: _userResults.length),
                  ),
                ),
              ],
            ] else ...[
              // Vista normal: buscas recentes + categorias
              if (ultimasPesquisas.isNotEmpty) ...[
                SliverToBoxAdapter(
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(left: 16),
                        child: Text(
                          "Buscas Recentes",
                          style: TextStyle(
                            color: context.colors.textPrimary,
                            fontSize: 25,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      TextButton(
                        onPressed: () {
                          setState(() {
                            ultimasPesquisas.clear();
                          });
                        },
                        child: Container(
                          margin: const EdgeInsets.only(right: 7),
                          child: Text(
                            "Limpar",
                            style: TextStyle(
                              color: context.colors.ambar,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                SliverToBoxAdapter(
                  child: Container(margin: const EdgeInsets.all(5)),
                ),
                SliverList(
                  delegate: SliverChildBuilderDelegate((context, index) {
                    final pesquisa = ultimasPesquisas[index];
                    return Column(
                      children: [
                        ListTile(
                          leading: Icon(
                            Icons.history,
                            color: context.colors.textDisabled,
                          ),
                          title: Text(
                            pesquisa,
                            style: TextStyle(
                              color: context.colors.textDisabled,
                            ),
                          ),
                          trailing: IconButton(
                            icon: Icon(
                              Icons.close,
                              color: context.colors.textDisabled,
                            ),
                            onPressed: () {
                              setState(() {
                                ultimasPesquisas.remove(pesquisa);
                              });
                            },
                          ),
                          onTap: () {
                            pesquisaController.text = pesquisa;
                            _onSearchChanged();
                          },
                        ),
                        Divider(
                          color: context.colors.grey,
                          height: 1,
                          indent: 16,
                          endIndent: 16,
                        ),
                      ],
                    );
                  }, childCount: ultimasPesquisas.length),
                ),
                SliverToBoxAdapter(
                  child: Container(
                    margin: const EdgeInsets.only(
                      left: 16,
                      right: 16,
                      bottom: 45,
                    ),
                    color: context.colors.grey,
                    height: 1,
                    width: double.infinity,
                  ),
                ),
              ],

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.only(bottom: 4),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Container(
                        margin: const EdgeInsets.only(left: 15),
                        child: Text(
                          _categoriaSelecionada ?? "Descubra por Categoria",
                          style: TextStyle(
                            color: context.colors.textPrimary,
                            fontSize: 25,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      if (_categoriaSelecionada != null)
                        Container(
                          margin: const EdgeInsets.only(right: 7),
                          child: IconButton(
                            icon: Icon(
                              Icons.close,
                              color: context.colors.textPrimary,
                            ),
                            onPressed: _voltarParaInicio,
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              if (_categoriaSelecionada == null) ...[
                SliverToBoxAdapter(
                  child: Container(
                    margin: const EdgeInsets.all(10),
                    child: Column(
                      children: () {
                        final pares = <List<Map<String, String>>>[];
                        for (var i = 0; i < _categorias.length; i += 2) {
                          pares.add(_categorias.sublist(i, i + 2));
                        }
                        return pares.map((par) {
                          return Row(
                            children: par.map((cat) {
                              return GestureDetector(
                                onTap: () =>
                                    _selecionarCategoria(cat['label']!),
                                child: Container(
                                  decoration: BoxDecoration(
                                    borderRadius: BorderRadius.circular(16),
                                    border: Border.all(
                                      color: context.colors.darkGrey,
                                      width: 1,
                                    ),
                                  ),
                                  margin: const EdgeInsets.all(6),
                                  width: (screenWidth / 2) - 25,
                                  height: (screenWidth / 2) - 25,
                                  child: Stack(
                                    children: [
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(16),
                                        child: SizedBox(
                                          width: double.infinity,
                                          height: double.infinity,
                                          child: Image.asset(
                                            cat['image']!,
                                            fit: BoxFit.cover,
                                          ),
                                        ),
                                      ),
                                      Positioned(
                                        bottom: 10,
                                        left: 10,
                                        child: Text(
                                          cat['label']!,
                                          style: const TextStyle(
                                            color: Colors.white,
                                            fontSize: 20,
                                            fontWeight: FontWeight.bold,
                                            shadows: [
                                              Shadow(
                                                color: Colors.white38,
                                                blurRadius: 8,
                                                offset: Offset(1, 1),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              );
                            }).toList(),
                          );
                        }).toList();
                      }(),
                    ),
                  ),
                ),
              ] else ...[
                if (provider.isLoading && places.isEmpty)
                  SliverFillRemaining(
                    child: Center(
                      child: CircularProgressIndicator(
                        color: context.colors.ambar,
                      ),
                    ),
                  )
                else if (listaFiltrada.isEmpty)
                  SliverFillRemaining(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        SizedBox(
                          height: 200,
                          width: 200,
                          child: Image.asset('assets/img/mascote/lupa.png'),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          'Nenhum lugar encontrado',
                          style: TextStyle(
                            color: context.colors.textDisabled,
                            fontSize: 16,
                            fontWeight: FontWeight.w500,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Ainda não há estabelecimentos nessa categoria',
                          style: TextStyle(
                            color: context.colors.textDisabled,
                            fontSize: 13,
                          ),
                        ),
                      ],
                    ),
                  )
                else
                  SliverPadding(
                    padding: const EdgeInsets.only(bottom: 80),
                    sliver: SliverList(
                      delegate: SliverChildBuilderDelegate((context, index) {
                        return PlaceCard(
                          place: listaFiltrada[index],
                          onTap: () {
                            Navigator.pushNamed(
                              context,
                              AppRoutes.placeDetail,
                              arguments: listaFiltrada[index].id,
                            );
                          },
                        );
                      }, childCount: listaFiltrada.length),
                    ),
                  ),
              ],

              SliverToBoxAdapter(child: const SizedBox(height: 40)),
            ],
          ],
        ),
      ),
    );
  }
}

class _UserSearchTile extends StatelessWidget {
  final UserSearchResult user;
  final VoidCallback onTap;

  const _UserSearchTile({required this.user, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        child: Row(
          children: [
            CircleAvatar(
              radius: 26,
              backgroundColor: context.colors.grey,
              backgroundImage:
                  (user.avatarUrl != null && user.avatarUrl!.isNotEmpty)
                  ? CachedNetworkImageProvider(user.avatarUrl!)
                  : null,
              child: (user.avatarUrl == null || user.avatarUrl!.isEmpty)
                  ? Icon(
                      Icons.person,
                      color: context.colors.textMuted,
                      size: 26,
                    )
                  : null,
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    user.name ?? user.username ?? '',
                    style: TextStyle(
                      color: context.colors.textPrimary,
                      fontSize: 15,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (user.username != null && user.username!.isNotEmpty)
                    Text(
                      '@${user.username}',
                      style: TextStyle(
                        color: context.colors.textMuted,
                        fontSize: 13,
                      ),
                    ),
                ],
              ),
            ),
            Text(
              '${user.followers} seguidores',
              style: TextStyle(
                color: context.colors.textDisabled,
                fontSize: 12,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
