/// Qual composição visual acompanha uma página do onboarding.
///
/// Cada valor é uma peça da história — problema → eventos → lugares →
/// descoberta — e tem o seu widget em `widgets/onboarding/visuals/`. Um enum,
/// e não o widget direto no conteúdo, para o texto das páginas continuar sendo
/// dado puro (`onboarding_content.dart`): reordenar ou reescrever uma página
/// não mexe em layout.
enum OnboardingVisual {
  /// Informação espalhada (story, grupo, flyer…) que converge pro Vibester.
  scattered,

  /// Cards reais de evento entrando em sequência.
  events,

  /// Trilho de estabelecimentos reais + categorias do Explorar.
  places,

  /// Tudo junto, orbitando a marca — fecha a história no CTA.
  discovery,
}

/// Uma página do onboarding.
class OnboardingSlide {
  /// Linha curta em DM Mono acima da manchete ("01 — O CORRE").
  final String eyebrow;

  /// Linhas da manchete em caixa alta, na ordem. A última sai em âmbar.
  ///
  /// Quebra manual, não automática: a manchete é um cartaz, e onde a linha
  /// quebra faz parte da frase. Cada linha encolhe sozinha se não couber.
  final List<String> headline;

  /// Texto de apoio — uma ou duas frases.
  final String body;

  /// Rótulo do botão principal nesta página.
  final String cta;

  final OnboardingVisual visual;

  const OnboardingSlide({
    required this.eyebrow,
    required this.headline,
    required this.body,
    required this.cta,
    required this.visual,
  });
}
