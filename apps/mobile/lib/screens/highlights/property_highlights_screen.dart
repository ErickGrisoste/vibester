import 'package:flutter/material.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/service/highlights/highlights_service.dart';
import 'package:mobile/widgets/cards/highlights/highlights_card.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:provider/provider.dart';

class PropertyHighlightsScreen extends StatefulWidget {
  final String? accountId;
  final String? placeId;

  /// Constrói slivers em vez de uma caixa rolável própria.
  ///
  /// Necessário no perfil: lá a grade fica dentro do `CustomScrollView` da
  /// página, e um `GridView` com scroll próprio ali dentro criaria duas áreas
  /// roláveis empilhadas — o dedo rolaria a grade e o cabeçalho do perfil
  /// nunca sairia da tela. Como sliver, tudo rola junto, e a construção
  /// continua preguiçosa (só as células visíveis são criadas).
  final bool asSliver;

  const PropertyHighlightsScreen({
    super.key,
    this.accountId,
    this.placeId,
    this.asSliver = false,
  });

  @override
  State<PropertyHighlightsScreen> createState() =>
      PropertyHighlightsScreenState();
}

/// Grade de fotos. Duas colunas em telas normais e três a partir de 600px de
/// largura, para o tablet não exibir seis fotos gigantes por tela.
const _gridDelegate = SliverGridDelegateWithMaxCrossAxisExtent(
  maxCrossAxisExtent: 240,
  childAspectRatio: 0.85,
  crossAxisSpacing: AppSpacing.sm,
  mainAxisSpacing: AppSpacing.sm,
);

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
      // Esqueleto na forma do grid: a página não muda de altura quando as
      // fotos chegam.
      return _wrapGrid(
        SliverGrid.builder(
          gridDelegate: _gridDelegate,
          itemCount: 6,
          itemBuilder: (_, _) => const VibesterSkeleton(),
        ),
      );
    }

    if (_erro != null) {
      return _wrapBox(
        VibesterState.error(message: _erro!, onAction: _buscarHighlights),
      );
    }

    if (_highlights.isEmpty) {
      return _wrapBox(
        const VibesterState(
          headline: 'Nenhuma foto',
          message: 'As publicações aparecem aqui em grade assim que existirem.',
          icon: Icons.photo_camera_outlined,
        ),
      );
    }

    return _wrapGrid(
      SliverGrid.builder(
        gridDelegate: _gridDelegate,
        itemCount: _highlights.length,
        itemBuilder: (context, index) => StaggeredEntrance(
          index: index,
          child: HighlightsCard(highlight: _highlights[index]),
        ),
      ),
    );
  }

  /// Envolve a grade no padding certo e, fora do modo sliver, num
  /// `CustomScrollView` próprio — que é o que o detalhe do estabelecimento
  /// precisa, já que lá a grade vive dentro de uma aba.
  Widget _wrapGrid(Widget sliverGrid) {
    const padding = EdgeInsets.fromLTRB(
      AppSpacing.md,
      AppSpacing.md,
      AppSpacing.md,
      AppSpacing.dockGap,
    );

    final padded = SliverPadding(padding: padding, sliver: sliverGrid);

    if (widget.asSliver) return padded;

    return CustomScrollView(slivers: [padded]);
  }

  Widget _wrapBox(Widget child) {
    if (widget.asSliver) {
      return SliverToBoxAdapter(child: child);
    }
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      children: [child],
    );
  }
}
