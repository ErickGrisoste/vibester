import 'package:flutter/material.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/places/place_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/place/place_card.dart';

class SearchByCategory extends StatefulWidget {
  final String categoria;

  const SearchByCategory({super.key, required this.categoria});

  @override
  State<SearchByCategory> createState() => _SearchByCategoryState();
}

class _SearchByCategoryState extends State<SearchByCategory> {
  final PlaceService _placeService = PlaceService();

  List<PlaceModel> _lista = [];
  bool _isLoading = true;
  String? _erro;

  @override
  void initState() {
    super.initState();
    _buscarPorCategoria();
  }

  @override
  void didUpdateWidget(SearchByCategory oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.categoria != widget.categoria) {
      _buscarPorCategoria();
    }
  }

  Future<void> _buscarPorCategoria() async {
    setState(() {
      _isLoading = true;
      _erro = null;
      _lista = [];
    });

    try {
      final lista = await _placeService.getPlacesByCategory(widget.categoria);
      setState(() {
        _lista = lista;
      });
    } catch (e) {
      setState(() {
        _erro = 'Não foi possível carregar os estabelecimentos';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return Center(
        child: CircularProgressIndicator(color: context.colors.ambar),
      );
    }

    if (_erro != null) {
      return Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.wifi_off, color: context.colors.textDisabled, size: 48),
          const SizedBox(height: 12),
          Text(
            _erro!,
            style: TextStyle(color: context.colors.textDisabled, fontSize: 16),
          ),
          const SizedBox(height: 16),
          TextButton(
            onPressed: _buscarPorCategoria,
            child: Text(
              'Tentar novamente',
              style: TextStyle(color: context.colors.ambar),
            ),
          ),
        ],
      );
    }

    if (_lista.isEmpty) {
      return Column(
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
            style: TextStyle(color: context.colors.textDisabled, fontSize: 13),
          ),
        ],
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.only(bottom: 80),
      itemCount: _lista.length,
      itemBuilder: (context, index) {
        return PlaceCard(
          place: _lista[index],
          onTap: () {
            Navigator.pushNamed(
              context,
              AppRoutes.placeDetail,
              arguments: _lista[index],
            );
          },
        );
      },
    );
  }
}
