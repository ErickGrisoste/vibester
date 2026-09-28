import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/place/place_model.dart';

/// `images` do `GET /establishment/establishments/:id` — as fotos do ambiente
/// que o botão do cabeçalho do detalhe abre em tela cheia. A listagem de
/// estabelecimentos não traz esse campo, então ausência tem que ser vazio, e
/// não erro.
void main() {
  Map<String, dynamic> perfil(dynamic images) => {
    'id': 'est-1',
    'name': 'Bar do Zé',
    'category': 'Bar',
    'images': images,
  };

  test('ordena as fotos por position, não pela ordem do corpo', () {
    final place = PlaceModel.fromJson(
      perfil([
        {'id': 'i-2', 'url': 'https://cdn/b.jpg', 'position': 1},
        {'id': 'i-1', 'url': 'https://cdn/a.jpg', 'position': 0},
        {'id': 'i-3', 'url': 'https://cdn/c.jpg', 'position': 2},
      ]),
    );

    expect(place.imagensAmbiente, [
      'https://cdn/a.jpg',
      'https://cdn/b.jpg',
      'https://cdn/c.jpg',
    ]);
  });

  test('descarta entrada sem url utilizável', () {
    final place = PlaceModel.fromJson(
      perfil([
        {'id': 'i-1', 'url': '', 'position': 0},
        {'id': 'i-2', 'position': 1},
        {'id': 'i-3', 'url': 'https://cdn/c.jpg', 'position': 2},
      ]),
    );

    expect(place.imagensAmbiente, ['https://cdn/c.jpg']);
  });

  test('lugar sem galeria (ou vindo da listagem) fica com lista vazia', () {
    expect(PlaceModel.fromJson(perfil([])).imagensAmbiente, isEmpty);
    expect(PlaceModel.fromJson(perfil(null)).imagensAmbiente, isEmpty);
    expect(PlaceModel.fromJson({'name': 'Bar do Zé'}).imagensAmbiente, isEmpty);
  });
}
