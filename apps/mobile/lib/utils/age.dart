/// Idade mínima para ter conta no Vibester. A mesma regra é aplicada pelo
/// auth-service no cadastro; aqui ela só evita a ida ao servidor.
const minimumAgeYears = 18;

/// `true` quando quem nasceu em [bornAt] já completou [years] anos em [now].
bool hasMinimumAge(DateTime bornAt, {int years = minimumAgeYears, DateTime? now}) {
  final hoje = now ?? DateTime.now();
  final limite = DateTime(hoje.year - years, hoje.month, hoje.day);
  final nascimento = DateTime(bornAt.year, bornAt.month, bornAt.day);
  return !nascimento.isAfter(limite);
}
