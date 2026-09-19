import 'package:flutter/material.dart';

/// Tokens de tipografia do Vibester.
///
/// O sistema tem duas vozes, e a separação entre elas é o que dá o tom
/// editorial/urbano do produto:
///
/// * **Outfit** (`ThemeData.fontFamily`, aplicada globalmente em [AppTheme]) —
///   emoção, marca, comunicação, ação. Títulos, corpo, botões, navegação.
/// * **DM Mono** ([mono] e derivados) — contexto, sistema, informação,
///   detalhe. Data, hora, categoria, distância, contador, status, tag.
///   Nunca em texto longo: é a etiqueta impressa em cima do poster, não o
///   poster.
///
/// Ao contrário de `AppColors`, esta classe NÃO é um `ThemeExtension`:
/// tamanho/peso/tracking não variam entre tema claro/escuro no Vibester —
/// só a cor do texto varia, e isso já é resolvido via `context.colors.*`.
/// Instância `const` única, acessada por `context.typography`
/// (`theme_extensions.dart`).
class AppTypography {
  const AppTypography();

  /// Família mono, para uso pontual em `copyWith(fontFamily: ...)` quando um
  /// dos tokens [mono*] não encaixar exatamente.
  static const String monoFamily = 'DMMono';

  /// Família principal. Já é o padrão do tema — só precisa ser declarada
  /// explicitamente ao voltar de mono para sans dentro do mesmo `TextSpan`.
  static const String sansFamily = 'Outfit';

  static const AppTypography instance = AppTypography();

  // -------------------------------------------------------------------
  // OUTFIT — display / editorial
  //
  // A escala é deliberadamente agressiva no topo: o Vibester é um produto de
  // poster, e a manchete precisa dominar a tela, não conviver de igual para
  // igual com o resto. Tracking negativo cresce junto com o tamanho.
  // -------------------------------------------------------------------

  /// Manchete de tela cheia — "O QUE TEM HOJE?", capa de onboarding, hero de
  /// evento. Uma por tela, no máximo.
  TextStyle get displayHuge => const TextStyle(
    fontSize: 44,
    fontWeight: FontWeight.w800,
    letterSpacing: -1.6,
    height: 0.94,
  );

  /// Título de evento em destaque (topo de `event_detail_screen`).
  TextStyle get displayLarge => const TextStyle(
    fontSize: 34,
    fontWeight: FontWeight.w800,
    letterSpacing: -1.1,
    height: 1.0,
  );

  /// Header de seção grande.
  TextStyle get displayMedium => const TextStyle(
    fontSize: 27,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.8,
    height: 1.08,
  );

  /// Título das telas de onboarding / abertura de bloco.
  TextStyle get headlineLarge => const TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.6,
    height: 1.1,
  );

  /// Título de evento em card.
  TextStyle get headlineMedium => const TextStyle(
    fontSize: 21,
    fontWeight: FontWeight.w700,
    letterSpacing: -0.4,
    height: 1.12,
  );

  /// Nome de estabelecimento em card.
  TextStyle get headlineSmall => const TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.25,
    height: 1.2,
  );

  /// Subtítulo forte / header de bloco.
  TextStyle get titleLarge => const TextStyle(
    fontSize: 17,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.2,
    height: 1.25,
  );

  /// Label de botão, CTA de card.
  TextStyle get titleMedium => const TextStyle(
    fontSize: 15,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.1,
    height: 1.3,
  );

  /// Label bold pequeno.
  TextStyle get titleSmall => const TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: -0.1,
    height: 1.3,
  );

  // -------------------------------------------------------------------
  // OUTFIT — corpo
  // -------------------------------------------------------------------

  /// Corpo principal / descrição.
  TextStyle get bodyLarge => const TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    height: 1.45,
  );

  /// Corpo secundário.
  TextStyle get bodyMedium => const TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    height: 1.5,
  );

  /// Caption.
  TextStyle get bodySmall => const TextStyle(
    fontSize: 13,
    fontWeight: FontWeight.w400,
    letterSpacing: 0,
    height: 1.4,
  );

  /// Label de botão pequeno / tab.
  TextStyle get labelLarge => const TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w600,
    letterSpacing: 0,
    height: 1.2,
  );

  /// Chip / badge legível.
  TextStyle get labelMedium => const TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w600,
    letterSpacing: 0.1,
    height: 1.2,
  );

  /// Selo mínimo.
  TextStyle get labelSmall => const TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.2,
    height: 1.1,
  );

  // -------------------------------------------------------------------
  // DM MONO — sistema
  //
  // Sempre com tracking positivo (mono já é largo, mas o espaçamento extra é
  // o que faz virar "etiqueta" em vez de "texto de código") e quase sempre
  // em caixa alta — mas caixa alta é decisão do call-site, não do token, pra
  // não forçar uppercase em nome próprio (ex. nome de estabelecimento).
  // -------------------------------------------------------------------

  /// Metadado principal do card: data, hora, distância. O mais usado.
  TextStyle get mono => const TextStyle(
    fontFamily: monoFamily,
    fontSize: 12,
    fontWeight: FontWeight.w500,
    letterSpacing: 0.6,
    height: 1.2,
  );

  /// Metadado secundário, menos contraste (sub-linha de card, rodapé).
  TextStyle get monoSmall => const TextStyle(
    fontFamily: monoFamily,
    fontSize: 11,
    fontWeight: FontWeight.w400,
    letterSpacing: 0.7,
    height: 1.2,
  );

  /// Selo mínimo — indicador de canto, contador, "AO VIVO".
  TextStyle get monoMicro => const TextStyle(
    fontFamily: monoFamily,
    fontSize: 9,
    fontWeight: FontWeight.w500,
    letterSpacing: 1.0,
    height: 1.1,
  );

  /// Eyebrow de seção — a linha de sistema que abre um bloco editorial
  /// ("01 / ACONTECENDO AGORA").
  TextStyle get monoEyebrow => const TextStyle(
    fontFamily: monoFamily,
    fontSize: 11,
    fontWeight: FontWeight.w500,
    letterSpacing: 1.8,
    height: 1.2,
  );

  /// Número grande de sistema — dia do mês no bloco de data, contador de
  /// perfil. Mono em tamanho display, com tracking apertado pra não virar
  /// uma fileira de dígitos soltos.
  TextStyle get monoDisplay => const TextStyle(
    fontFamily: monoFamily,
    fontSize: 26,
    fontWeight: FontWeight.w500,
    letterSpacing: -0.5,
    height: 1.0,
  );

  /// Texto de sticker/tag colada sobre imagem.
  TextStyle get monoTag => const TextStyle(
    fontFamily: monoFamily,
    fontSize: 10,
    fontWeight: FontWeight.w500,
    letterSpacing: 1.2,
    height: 1.1,
  );
}
