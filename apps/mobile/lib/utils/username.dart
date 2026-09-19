/// Formata um nome de usuário para exibição, com exatamente um `@`.
///
/// Existe porque a origem do dado é inconsistente e as telas não têm como
/// saber qual delas estão recebendo: `RegisterScreen` cria o username já com
/// arroba (`'@$nome'`) e `PersonalInformationSettings` também garante o
/// prefixo ao salvar, enquanto a busca de usuários e o autor de um post podem
/// devolver o valor cru. Cada tela que fazia `'@${user.nomeUsuario}'` por
/// conta própria acabava exibindo `@@fulano` para quem já tinha o prefixo.
///
/// Devolve string vazia quando não há nome — cabe ao call-site decidir o
/// fallback visual (normalmente `'@—'`).
String formatHandle(String? username) {
  final limpo = (username ?? '').trim().replaceAll(RegExp(r'^@+'), '');
  return limpo.isEmpty ? '' : '@$limpo';
}
