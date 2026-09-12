import 'package:flutter/foundation.dart';
import 'package:mobile/models/place/place_model.dart';
import 'package:mobile/service/highlights/close_to_you_service.dart';
import 'package:mobile/service/location/location_service.dart';
import 'package:mobile/utils/data_freshness.dart';

/// Situação da permissão/leitura de localização, do ponto de vista da
/// interface. A tela precisa saber *por que* não há lista, não só que ela
/// está vazia.
enum LocationStatus {
  /// Ainda não foi pedida — a Home só pede quando a seção entra em cena.
  idle,

  /// Pedindo posição ao sistema.
  locating,

  /// Posição obtida.
  ready,

  /// Sem permissão ou GPS desligado. A tela oferece tentar de novo.
  unavailable,
}

/// Estabelecimentos próximos + a posição do aparelho.
///
/// Antes, latitude/longitude viviam em variáveis globais mutáveis
/// (`utils/location_satate.dart`) que qualquer tela escrevia e um
/// `FutureBuilder` em outra tela lia — dava pra abrir a Home e ver a seção
/// "perto de você" em branco só porque a aba certa não tinha sido tocada
/// antes. Aqui a posição pertence a quem usa: o provider busca sozinho na
/// primeira vez e reusa dentro da janela de staleness, como os demais
/// providers do app.
class NearbyProvider extends ChangeNotifier {
  final LocationService _location = LocationService();
  final CloseToYouService _service = CloseToYouService();

  List<PlaceModel> _places = [];
  LocationStatus _status = LocationStatus.idle;
  DateTime? _lastFetchedAt;
  bool _isLoading = false;
  String? _error;

  double? _latitude;
  double? _longitude;

  List<PlaceModel> get places => _places;
  LocationStatus get status => _status;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get hasLocation => _latitude != null && _longitude != null;

  double? get latitude => _latitude;
  double? get longitude => _longitude;

  /// Busca a posição e, com ela, os estabelecimentos por perto.
  ///
  /// Ver `PlaceListProvider.fetchPlaces` para a lógica de staleness. [force] é
  /// o caminho do pull-to-refresh e do botão "tentar de novo" — só ele refaz a
  /// leitura de GPS, que é a parte cara.
  Future<void> load({bool force = false}) async {
    if (_isLoading) return;
    if (!force && _places.isNotEmpty && !isDataStale(_lastFetchedAt)) return;

    _isLoading = true;
    _error = null;
    if (!hasLocation || force) _status = LocationStatus.locating;
    notifyListeners();

    try {
      if (!hasLocation || force) {
        final position = await _location.getCurrentPosition();
        _latitude = position.latitude;
        _longitude = position.longitude;
      }
      _status = LocationStatus.ready;
    } catch (e) {
      // Permissão negada, GPS desligado ou timeout: não é erro de rede, é
      // ausência de um pré-requisito — a tela trata diferente.
      _status = LocationStatus.unavailable;
      _isLoading = false;
      debugPrint('NearbyProvider: sem localização ($e)');
      notifyListeners();
      return;
    }

    try {
      _places = await _service.getEstablishmentsNearby(
        latitude: _latitude!,
        longitude: _longitude!,
      );
      _lastFetchedAt = DateTime.now();
    } catch (e) {
      _error = 'Não foi possível carregar o que está perto de você';
      debugPrint('NearbyProvider: falha ao buscar próximos ($e)');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}
