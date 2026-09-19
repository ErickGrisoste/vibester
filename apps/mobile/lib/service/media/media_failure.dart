import 'package:geolocator/geolocator.dart';

/// Por que a mídia não veio. Câmera e galeria falam o mesmo vocabulário, então
/// a tela trata negação do mesmo jeito qualquer que seja a origem.
enum MediaFailure {
  /// Negada agora — dá para pedir de novo.
  permissionDenied,

  /// Negada de vez (ou restrita por controle parental): o sistema não mostra
  /// mais o pedido, só os ajustes do aparelho resolvem.
  permissionBlocked,

  /// O aparelho não tem uma câmera utilizável.
  unavailable,

  /// Vídeo acima da duração aceita.
  tooLong,

  /// A pessoa desistiu no meio (saiu durante a compressão). Não é erro para
  /// mostrar.
  cancelled,

  /// Falhou por outro motivo (abrir, capturar, processar).
  failed,
}

/// Falha do fluxo de mídia com a mensagem que pode ir para a tela.
///
/// `toString` devolve só a mensagem, então o padrão já usado pelas telas
/// (`e.toString().replaceFirst('Exception: ', '')`) funciona sem caso especial.
class MediaException implements Exception {
  final MediaFailure failure;
  final String message;

  const MediaException(this.failure, this.message);

  bool get isPermission =>
      failure == MediaFailure.permissionDenied ||
      failure == MediaFailure.permissionBlocked;

  @override
  String toString() => message;
}

/// Abre a tela de ajustes do app no sistema.
///
/// Reaproveita o `geolocator`, que já está no app e expõe exatamente esse
/// atalho no Android e no iOS — evita trazer um `permission_handler` inteiro
/// só para um botão.
Future<bool> openAppSettings() => Geolocator.openAppSettings();
