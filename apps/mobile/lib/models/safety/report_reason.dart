/// O que está sendo denunciado. `apiValue` é o contrato do user-service.
enum ReportTargetType {
  user('USER'),
  post('POST');

  const ReportTargetType(this.apiValue);

  final String apiValue;
}

/// Motivos de denúncia, na ordem em que aparecem para o usuário.
enum ReportReason {
  harassment('HARASSMENT', 'Assédio ou bullying'),
  hate('HATE', 'Discurso de ódio'),
  violence('VIOLENCE', 'Violência ou ameaça'),
  nudity('NUDITY', 'Nudez ou conteúdo sexual'),
  illegal('ILLEGAL', 'Drogas ou outra atividade ilegal'),
  spam('SPAM', 'Spam ou golpe'),
  impersonation('IMPERSONATION', 'Perfil falso ou se passando por alguém'),
  underage('UNDERAGE', 'Pessoa menor de 18 anos'),
  other('OTHER', 'Outro motivo');

  const ReportReason(this.apiValue, this.label);

  final String apiValue;
  final String label;
}
