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

    // Sem timeLimit, getCurrentPosition pode nunca completar (ambiente
    // fechado, emulador sem posição simulada) e a seção "perto de você"
    // ficava no skeleton para sempre. Precisão média basta para raio em km e
    // resolve bem mais rápido que a alta.
    try {
      return await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 10),
        ),
      );
    } catch (e) {
      final ultima = await Geolocator.getLastKnownPosition();
      if (ultima != null) return ultima;
      rethrow;
    }
  }
}
