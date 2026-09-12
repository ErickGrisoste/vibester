import 'package:flutter/material.dart';

class AppColors extends ThemeExtension<AppColors> {
  final Color navy;
  final Color ambar;
  final Color grey;
  final Color darkGrey;
  final Color brasa;
  final Color noturno;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textDisabled;
  final Color border;
  final Color error;

  const AppColors({
    required this.navy,
    required this.ambar,
    required this.grey,
    required this.darkGrey,
    required this.brasa,
    required this.noturno,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textDisabled,
    required this.border,
    required this.error,
  });

  /// Gradiente da marca, derivado de `ambar` e `brasa` do tema atual.
  ///
  /// Use em `BoxDecoration.gradient` para fundos, cards e botões; para texto
  /// e ícones use `GradientMask` (theme_extensions.dart).
  LinearGradient get gradient => LinearGradient(colors: [ambar, brasa]);

  // -------------------------------------------------------------------
  // Superfícies derivadas
  //
  // A paleta do Vibester (navy / ambar / brasa / noturno / darkGrey / grey) é
  // patrimônio da marca e não muda. O que falta pra construir hierarquia de
  // profundidade não é cor nova, e sim *camada*: as superfícies abaixo são
  // todas derivadas por opacidade/mistura dos tokens existentes, então o app
  // continua cromaticamente idêntico a si mesmo.
  // -------------------------------------------------------------------

  /// Fundo de tela. Alias semântico de [noturno].
  Color get background => noturno;

  /// Primeira camada acima do fundo (bloco, célula de lista, campo). Um
  /// [navy] muito diluído sobre o fundo — dá relevo sem virar "card cinza".
  Color get surface => Color.alphaBlend(navy.withValues(alpha: 0.55), noturno);

  /// Segunda camada (sheet, painel sobreposto, dock).
  Color get surfaceRaised =>
      Color.alphaBlend(navy.withValues(alpha: 0.88), noturno);

  /// Traço estrutural discreto — separadores e contornos de superfície, onde
  /// [border] (white38) seria alto demais.
  Color get hairline => grey.withValues(alpha: 0.18);

  /// Traço de contorno visível, usado como elemento gráfico (moldura de
  /// poster, chip selecionado).
  Color get outline => grey.withValues(alpha: 0.38);

  /// Véu sobre imagem para garantir contraste de texto sobreposto. Sempre
  /// preto real: escurecer com [noturno] tingiria a foto de roxo.
  Color get scrim => const Color(0xFF000000);

  /// Gradiente de leitura para texto sobre foto (transparente → escuro).
  /// Usado por todo card com metadado sobreposto.
  LinearGradient get photoScrim => LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: const [0.0, 0.45, 1.0],
    colors: [
      scrim.withValues(alpha: 0.0),
      scrim.withValues(alpha: 0.45),
      scrim.withValues(alpha: 0.92),
    ],
  );

  /// Véu de cor de marca sobre a base de uma foto, aplicado **por cima** do
  /// [photoScrim].
  ///
  /// O scrim sozinho é preto: garante contraste, mas deixa todo card com a
  /// mesma base cinza-escura, seja qual for a foto. Este véu devolve a
  /// temperatura da marca à parte inferior do cartaz — é o mesmo efeito de
  /// tinta atravessando papel de lambe-lambe — sem tocar no topo da imagem,
  /// onde a foto ainda precisa aparecer limpa.
  ///
  /// Vem depois do scrim de propósito: a legibilidade do texto continua sendo
  /// garantida pelo preto, e a cor entra como camada, não como substituta.
  LinearGradient photoTint(Color accent) => LinearGradient(
    begin: Alignment.topCenter,
    end: Alignment.bottomCenter,
    stops: const [0.35, 1.0],
    colors: [accent.withValues(alpha: 0.0), accent.withValues(alpha: 0.30)],
  );

  /// Cor de "ao vivo / acontecendo agora". É [brasa] — a única cor quente
  /// urgente da paleta — isolada num nome semântico pra não ser usada como
  /// decoração genérica.
  Color get live => brasa;

  /// Tinta escura da marca, fixa nos dois temas.
  ///
  /// É o [noturno] do tema escuro usado como *cor de texto*, não como fundo:
  /// por isso é constante e não acompanha o tema — ela existe para ficar sobre
  /// preenchimentos de marca, que também não mudam entre temas.
  static const Color ink = Color(0xFF0C0910);

  /// Cor legível de texto/ícone sobre um preenchimento sólido.
  ///
  /// Escolhe entre [ink] e branco pela razão de contraste real, em vez de
  /// assumir branco. Isso não é preciosismo: branco sobre `ambar` (#F88806)
  /// dá **2,47:1**, abaixo até do piso de 3:1 da WCAG para texto grande — era
  /// o rótulo de todo botão principal, chip selecionado e tag de marca do app.
  /// Com [ink] a mesma combinação vai a 8:1, e de quebra fica mais parecida
  /// com tinta preta sobre papel laranja, que é a direção de cartaz do
  /// produto.
  ///
  /// Em fundos escuros (o vermelho de erro do tema claro, por exemplo) a conta
  /// devolve branco sozinha — nenhuma tela precisa decidir isso na mão.
  Color onFill(Color background) {
    final luminancia = background.computeLuminance();
    final contrasteComBranco = 1.05 / (luminancia + 0.05);
    final contrasteComTinta =
        (luminancia + 0.05) / (ink.computeLuminance() + 0.05);

    return contrasteComTinta >= contrasteComBranco ? ink : Colors.white;
  }

  /// Atalho para o caso mais comum: texto sobre [ambar].
  Color get onAmbar => onFill(ambar);

  /// Texto sobre [brasa].
  Color get onBrasa => onFill(brasa);

  static const AppColors dark = AppColors(
    navy: Color(0xFF17112A),
    ambar: Color(0xFFF88806),
    grey: Color(0xFF94A3B8),
    darkGrey: Color(0xFF0E0E0E),
    brasa: Color(0xFFFF4D1C),
    noturno: Color(0xFF0C0910),
    textPrimary: Colors.white,
    textSecondary: Colors.white70,
    textMuted: Colors.white54,
    textDisabled: Colors.white38,
    border: Colors.white38,
    error: Color(0xFFFF5252),
  );

  static const AppColors light = AppColors(
    navy: Color.fromARGB(255, 136, 123, 179),
    ambar: Color(0xFFF88806),
    grey: Color(0xFF94A3B8),
    darkGrey: Color(0xFFF0EDF5),
    brasa: Color(0xFFFF4D1C),
    noturno: Color(0xFFFFFFFF),
    textPrimary: Color(0xFF17112A),
    textSecondary: Color(0xFF4B4560),
    textMuted: Color(0xFF6B6580),
    textDisabled: Color(0xFF9A94AC),
    border: Color(0xFFD8D3E0),
    error: Color(0xFFD32F2F),
  );

  /// Alias mantido para não quebrar código legado que ainda referencie o
  /// nome antigo; equivale ao tema escuro (paleta original do app).
  static const AppColors defaultColors = dark;

  @override
  AppColors copyWith({
    Color? navy,
    Color? ambar,
    Color? grey,
    Color? darkGrey,
    Color? brasa,
    Color? noturno,
    Color? textPrimary,
    Color? textSecondary,
    Color? textMuted,
    Color? textDisabled,
    Color? border,
    Color? error,
  }) {
    return AppColors(
      navy: navy ?? this.navy,
      ambar: ambar ?? this.ambar,
      grey: grey ?? this.grey,
      darkGrey: darkGrey ?? this.darkGrey,
      brasa: brasa ?? this.brasa,
      noturno: noturno ?? this.noturno,
      textPrimary: textPrimary ?? this.textPrimary,
      textSecondary: textSecondary ?? this.textSecondary,
      textMuted: textMuted ?? this.textMuted,
      textDisabled: textDisabled ?? this.textDisabled,
      border: border ?? this.border,
      error: error ?? this.error,
    );
  }

  @override
  AppColors lerp(ThemeExtension<AppColors>? other, double t) {
    if (other is! AppColors) return this;
    return AppColors(
      navy: Color.lerp(navy, other.navy, t)!,
      ambar: Color.lerp(ambar, other.ambar, t)!,
      grey: Color.lerp(grey, other.grey, t)!,
      darkGrey: Color.lerp(darkGrey, other.darkGrey, t)!,
      brasa: Color.lerp(brasa, other.brasa, t)!,
      noturno: Color.lerp(noturno, other.noturno, t)!,
      textPrimary: Color.lerp(textPrimary, other.textPrimary, t)!,
      textSecondary: Color.lerp(textSecondary, other.textSecondary, t)!,
      textMuted: Color.lerp(textMuted, other.textMuted, t)!,
      textDisabled: Color.lerp(textDisabled, other.textDisabled, t)!,
      border: Color.lerp(border, other.border, t)!,
      error: Color.lerp(error, other.error, t)!,
    );
  }
}
