import 'package:geolocator/geolocator.dart';

class LocationService {
  Future<Position> getCurrentPosition() async {
    final servicoAtivado = await Geolocator.isLocationServiceEnabled();
    if (!servicoAtivado) {
      throw Exception(
        'Ative a localização do seu dispositivo para usar essa função.',
      );
    }

    var permissao = await Geolocator.checkPermission();

    if (permissao == LocationPermission.denied) {
      permissao = await Geolocator.requestPermission();
      if (permissao == LocationPermission.denied) {
        throw Exception('Permissão de localização negada.');
      }
    }

    if (permissao == LocationPermission.deniedForever) {
      throw Exception(
        'Permissão de localização negada permanentemente. '
        'Ative nas configurações do aparelho.',
      );
    }

    return Geolocator.getCurrentPosition();
  }
}
