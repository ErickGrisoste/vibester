/// Links públicos de compartilhamento de evento e estabelecimento.
///
/// Apontam para a landing page (`apps/landing-page`), que mostra a prévia e o
/// botão "Abrir no Vibester" (`vibester://event/{id}` e
/// `vibester://place/{id}`, tratados em `main.dart`). Diferente do perfil, não
/// há token no backend: o id do evento/estabelecimento já é público nas rotas
/// de detalhe, então o link é montado aqui sem round-trip e não expira.
class ShareLinks {
  static const String webBaseUrl = 'https://vibester.com.br';

  static String event(String eventId) => '$webBaseUrl/e/$eventId';
  static String place(String placeId) => '$webBaseUrl/l/$placeId';
}
