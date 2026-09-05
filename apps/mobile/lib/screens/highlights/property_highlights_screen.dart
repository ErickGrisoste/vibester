import 'package:flutter/material.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/service/highlights/highlights_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/highlights/highlights_card.dart';
import 'package:provider/provider.dart';

class PropertyHighlightsScreen extends StatefulWidget {
  final String? accountId;
  final String? placeId;

  const PropertyHighlightsScreen({super.key, this.accountId, this.placeId});

  @override
  State<PropertyHighlightsScreen> createState() =>
      PropertyHighlightsScreenState();
}

class PropertyHighlightsScreenState extends State<PropertyHighlightsScreen>
    with AutomaticKeepAliveClientMixin<PropertyHighlightsScreen> {
  final HighlightsService _highlightsService = HighlightsService();

  @override
  bool get wantKeepAlive => true;

  // Guardam qual id a tela recebeu e de quem
  late String? _accountId;
  late String? _placeId;

  List<HighlightModel> _highlights = [];
  bool _isLoading = true;
  String? _erro;

  @override
  void initState() {
    super.initState();
    _accountId = widget.accountId;
    _placeId = widget.placeId;
    _buscarHighlights();
  }

  @override
  void didUpdateWidget(PropertyHighlightsScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.accountId != widget.accountId ||
        oldWidget.placeId != widget.placeId) {
      _accountId = widget.accountId;
      _placeId = widget.placeId;
      _buscarHighlights();
    }
  }

  Future<void> refresh() => _buscarHighlights();

  Future<void> _buscarHighlights() async {
    setState(() {
      _isLoading = true;
      _erro = null;
    });

    try {
      List<HighlightModel> highlights;
      final viewerId = context.read<UserProvider>().user?.accountId;

      if (_accountId != null && _accountId!.isNotEmpty) {
        // Chamado a partir do perfil de usuário.
        highlights = await _highlightsService.getHighlightsByAccountId(
          _accountId!,
          viewerId: viewerId,
        );
      } else if (_placeId != null && _placeId!.isNotEmpty) {
        // Chamado a partir do detalhe de um estabelecimento
        highlights = await _highlightsService.getHighlightsByEstablishmentId(
          _placeId!,
          viewerId: viewerId,
        );
      } else {
        highlights = [];
      }

      setState(() {
        _highlights = highlights;
      });
    } catch (e) {
      setState(() {
        _erro = 'Não foi possível carregar as fotos';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    super.build(context);

    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(color: context.colors.ambar),
      );
    }

    if (_erro != null) {
      return LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.wifi_off,
                      color: context.colors.textDisabled,
                      size: 48,
                    ),
                    const SizedBox(height: 12),
                    Text(
                      _erro!,
                      style: TextStyle(
                        color: context.colors.textDisabled,
                        fontSize: 16,
                      ),
                    ),
                    const SizedBox(height: 16),
                    TextButton(
                      onPressed: _buscarHighlights,
                      child: Text(
                        'Tentar novamente',
                        style: TextStyle(color: context.colors.ambar),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    }

    if (_highlights.isEmpty) {
      return LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: Center(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      height: 200,
                      width: 200,
                      child: Opacity(
                        opacity: 0.8,
                        child: Image.asset('assets/img/mascote/lupa.png'),
                      ),
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Nenhuma foto ainda',
                      style: TextStyle(
                        color: context.colors.textDisabled,
                        fontSize: 16,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        },
      );
    }

    return Scaffold(
      backgroundColor: context.colors.noturno,

      //Uso o gridview no lugar do listview pq é mais simples de mecher e de montar as imagens
      //O gridview pega toda a largura ta tela, q é dividido pelo crossAC e pelo childAR
      body: GridView.builder(
        // Deve ser dinamico e não fixo
        itemCount: _highlights.length,
        gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
          //pega a largura da tela dividido por 2 (pra dar duas imagens por linha)
          crossAxisCount: 2,
          //define a altura com base na largura
          childAspectRatio: 0.85,

          crossAxisSpacing: 10,
          mainAxisSpacing: 10,
        ),
        padding: const EdgeInsets.only(
          top: 30,
          left: 12,
          right: 12,
          bottom: 12,
        ),
        itemBuilder: (context, index) {
          return HighlightsCard(highlight: _highlights[index]);
        },
      ),
    );
  }
}
