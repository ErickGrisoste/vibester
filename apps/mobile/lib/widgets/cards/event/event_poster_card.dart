import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/utils/hero_tags.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_tag.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/sticker_tag.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Contexto em que o card aparece. Um componente, quatro composições — em
/// vez de quatro widgets quase iguais (era o caso antes: `EventCard`,
/// `FeaturedEvents`, `WeeklyEvents` e `IWillGoEventCard` repetiam a mesma
/// imagem com scrim e o mesmo `DateFormat` de quatro maneiras diferentes).
enum EventCardVariant {
  /// Cartaz de trilho horizontal — o card de evento da Home.
  hero,

  /// Cartaz miúdo, para trilho denso onde o evento é sugestão, não manchete.
  compact,

  /// Linha larga de lista vertical, com bloco de data à esquerda.
  wide,
}

/// Card de evento do Vibester.
///
/// O princípio é **imagem primeiro**: o cartaz do evento é o conteúdo, não a
/// ilustração de um formulário. Por isso não existe caixa branca em volta,
/// nem título fora da arte — o texto entra *sobre* a imagem, protegido por um
/// scrim de leitura, como legenda impressa sobre um lambe-lambe.
///
/// **Forma.** As quatro quinas têm o mesmo raio. O card não usa mais o "canto
/// rasgado" (quina inferior esquerda reta) descrito no `DESIGN_SYSTEM.md` §4
/// — foi decisão de produto para este componente. `PlaceTile`, o card de post
/// e a foto de perfil continuam com o canto rasgado; se a decisão valer pro
/// app inteiro, é lá que ela precisa ser repetida.
///
/// **Escala.** O cartaz é um retângulo deitado 16:10 ([posterAspect]) que
/// ocupa 74% da largura da tela no trilho ([railWidth]) — antes era retrato
/// 3:4 a 76%, ou seja ~450pt de altura: um evento por tela, sem comparação
/// possível entre dois rolês e com o cabeçalho da seção já fora de vista.
/// Deitado, o mesmo card ocupa ~180pt: cabe a seção inteira no campo de
/// visão, e a foto do evento (quase sempre um flyer horizontal ou uma foto de
/// pista) entra sem ser cortada nas laterais.
///
/// **Cor e moldura.** O card tem moldura de acento — `brasa` quando o evento
/// está rolando, `ambar` no resto — e um véu da mesma cor subindo da base da
/// foto (`AppColors.photoTint`), por cima do scrim preto. O metadado embaixo
/// e a etiqueta de categoria em cima usam esse mesmo acento: um card com foto
/// escura continua sendo um objeto colorido na tela, não um retângulo cinza.
/// Não há sombra nem halo por baixo: quem separa o card do fundo é a moldura.
///
/// **Legenda.** Categoria e título em caixa alta, e a linha de metadado traz
/// só hora e local — sem data. Quando o evento é hoje ou está rolando, quem
/// diz isso é o selo colado no topo.
class EventPosterCard extends StatelessWidget {
  final EventModel event;
  final EventCardVariant variant;

  /// Largura fixa (trilhos horizontais). Nulo = ocupa a largura disponível.
  final double? width;

  /// Toque. Padrão: abre o detalhe do evento.
  final VoidCallback? onTap;

  /// Participa da transição compartilhada card → detalhe. Desligue quando o
  /// mesmo evento puder aparecer duas vezes na mesma tela (dois `Hero` com a
  /// mesma tag na mesma rota quebram a transição).
  final bool hero;

  const EventPosterCard({
    super.key,
    required this.event,
    this.variant = EventCardVariant.hero,
    this.width,
    this.onTap,
    this.hero = true,
  });

  /// Raio igual nas quatro quinas — ver a nota de **Forma** na classe.
  static const _cornerRadius = BorderRadius.all(Radius.circular(AppRadius.md));

  /// Proporção do cartaz: retângulo deitado, largura maior que altura.
  ///
  /// Era 3:4 (retrato), o que num aparelho de 390pt dava ~450pt de altura —
  /// **um** evento por tela. Em 16:10 o mesmo card fica em ~180pt: o trilho
  /// inteiro cabe abaixo do cabeçalho da seção, e a proporção deitada é a que
  /// combina com a imagem que a API costuma entregar (flyer horizontal, foto
  /// de pista), que no formato retrato vinha cortada nas laterais.
  static const double posterAspect = 16 / 10;

  /// Largura do cartaz num trilho horizontal, derivada da largura da tela.
  ///
  /// Os 0.74 deixam o card largo — é a dimensão que ele ganhou ao deitar — e
  /// ainda assim reservam a faixa da direita pro próximo cartaz aparecer: é
  /// essa borda visível que comunica que o trilho anda pro lado. O piso e o
  /// teto seguram o tamanho nos extremos (aparelho estreito e tablet).
  static double railWidth(BuildContext context) =>
      (MediaQuery.sizeOf(context).width * 0.74).clamp(240.0, 340.0);

  /// Altura correspondente a [railWidth] — é o que o trilho horizontal
  /// reserva. Como todo o texto do cartaz vive *dentro* da imagem, a altura
  /// depende só da largura: nenhum ajuste de fonte do sistema pode estourar
  /// o trilho.
  static double railHeight(BuildContext context) =>
      railWidth(context) / posterAspect;

  /// Mesma forma do cartaz, em escala menor — miniatura da variante `wide`.
  static const _thumbCornerRadius = BorderRadius.all(
    Radius.circular(AppRadius.sm),
  );

  void _open(BuildContext context) {
    if (onTap != null) {
      onTap!();
      return;
    }
    Navigator.pushNamed(context, AppRoutes.eventDetail, arguments: event);
  }

  @override
  Widget build(BuildContext context) {
    return VibesterPressable(
      onTap: () => _open(context),
      pressScale: AppMotion.scalePress,
      borderRadius: _cornerRadius,
      child: switch (variant) {
        EventCardVariant.hero => _buildPoster(context, large: true),
        EventCardVariant.compact => _buildPoster(context, large: false),
        EventCardVariant.wide => _buildWide(context),
      },
    );
  }

  Widget _image(BuildContext context) {
    final image = VibesterImage(
      source: event.imageUrl,
      alignment: Alignment.topCenter,
      placeholderIcon: Icons.local_activity_outlined,
    );
    return hero ? Hero(tag: eventImageHeroTag(event), child: image) : image;
  }

  // -------------------------------------------------------------------
  // Cartaz (hero / compact)
  // -------------------------------------------------------------------

  Widget _buildPoster(BuildContext context, {required bool large}) {
    final colors = context.colors;
    final type = context.typography;
    final happening = event.isHappeningNow;

    // Acento do card. Um evento rolando agora puxa `brasa` — a cor urgente da
    // paleta — e o resto puxa `ambar`. É essa cor que aparece na moldura, no
    // véu sobre a foto e no metadado: três lugares, uma decisão só.
    final accent = happening ? colors.live : colors.ambar;

    // A moldura do card que está rolando é sólida; a dos outros é a mesma cor
    // em meia força. A hierarquia continua de pé mesmo com todo card colorido.
    final frame = happening ? accent : accent.withValues(alpha: 0.55);

    // Sem data na legenda: sobra hora e local. Que dia é hoje o usuário sabe,
    // e "é hoje / é agora" já está dito pelo selo no topo do cartaz.
    final meta = event.metaLine(includeDay: false, includeLocation: large);

    final padding = large ? AppSpacing.md : AppSpacing.sm + 2;

    return SizedBox(
      width: width ?? (large ? 300 : 190),
      child: AspectRatio(
        aspectRatio: posterAspect,
        // Sem sombra nem halo: o que separa o cartaz do fundo é a moldura de
        // acento. Moldura em `foreground` porque um `Border` de fundo ficaria
        // coberto na metade de dentro pela foto, que é filha e pinta por cima
        // — aqui ela é a última coisa desenhada e o traço aparece inteiro.
        child: DecoratedBox(
          position: DecorationPosition.foreground,
          decoration: BoxDecoration(
            borderRadius: _cornerRadius,
            border: Border.all(color: frame, width: AppStroke.regular),
          ),
          child: ClipRRect(
            borderRadius: _cornerRadius,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _image(context),

                // Grão → scrim preto (legibilidade) → véu de cor (marca).
                // O grão é o que impede a foto de parecer um banner de
                // stock e amarra o card à textura do resto do app.
                const Grain(opacity: 0.06, density: 0.4),
                DecoratedBox(
                  decoration: BoxDecoration(gradient: colors.photoScrim),
                ),
                DecoratedBox(
                  decoration: BoxDecoration(gradient: colors.photoTint(accent)),
                ),

                // Selo urgente no topo — só quando o horário sustenta. É ele
                // que carrega "hoje"/"agora" desde que a data saiu da legenda.
                if (happening)
                  Positioned(
                    top: padding,
                    left: padding,
                    child: const StickerTag.live(),
                  )
                else if (event.isToday)
                  Positioned(
                    top: padding,
                    left: padding,
                    child: const StickerTag(label: 'HOJE'),
                  ),

                // Categoria do outro lado do topo, preenchida em `ambar` e em
                // caixa alta (o `VibesterTag` já faz isso). Só no card grande:
                // no miúdo ela roubaria a linha do título.
                if (large && event.categoria.isNotEmpty)
                  Positioned(
                    top: padding,
                    right: padding,
                    child: VibesterTag(event.categoria, tone: TagTone.brand),
                  ),

                // Legenda do cartaz: metadado em mono **acima** do título,
                // não abaixo. É a mesma ordem do `SectionHeader` (eyebrow →
                // manchete), e é a que funciona quando o card encolhe: a
                // linha de sistema fica na base fixa da composição e o
                // título cresce pra cima, em vez de empurrar o metadado
                // pra fora.
                Positioned(
                  left: padding,
                  right: padding,
                  bottom: padding,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        meta,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: (large ? type.monoSmall : type.monoMicro)
                            .copyWith(color: accent),
                      ),
                      SizedBox(
                        height: large ? AppSpacing.xs + 2 : AppSpacing.xs,
                      ),
                      Text(
                        event.titulo.toUpperCase(),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: (large ? type.headlineMedium : type.titleMedium)
                            .copyWith(
                              color: Colors.white,
                              // Caixa alta pede tracking menos apertado: o
                              // negativo do token foi desenhado pra caixa
                              // baixa, e em maiúscula ele cola as letras.
                              letterSpacing: 0,
                            ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  // -------------------------------------------------------------------
  // Linha larga (wide)
  // -------------------------------------------------------------------

  Widget _buildWide(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final countdown = event.countdownLabel;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      // `_DateBlock` estica um traço vertical com `CrossAxisAlignment.stretch`
      // (precisa de uma altura concreta pra se esticar até ela). Fora de um
      // `ListView`/lista com item de altura fixa, o `Row` recebe altura
      // infinita do pai (ex.: dentro de um `Column` comum, como a seção
      // "Essa semana" da Home) e o stretch quebra o layout. `IntrinsicHeight`
      // resolve isso: mede a altura que o conteúdo realmente precisa (a maior
      // entre data, texto e miniatura) e usa ela como altura da linha.
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _DateBlock(event: event),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Caixa alta como no cartaz: as duas variantes convivem na
                  // mesma tela (trilho e "Essa semana"), e o nome do rolê tem
                  // que parecer o mesmo tipo de coisa nas duas.
                  Text(
                    event.titulo.toUpperCase(),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: type.headlineSmall.copyWith(
                      color: colors.textPrimary,
                      letterSpacing: 0,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xs + 2),
                  Text(
                    [
                      event.timeLabel,
                      if (event.localizacao.isNotEmpty)
                        event.localizacao.toUpperCase(),
                    ].join('  ·  '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: type.monoSmall.copyWith(color: colors.textMuted),
                  ),
                  if (countdown != null) ...[
                    const SizedBox(height: AppSpacing.sm),
                    VibesterTag(countdown, tone: TagTone.live),
                  ],
                ],
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            // Miniatura com a mesma moldura de acento do cartaz — é o que
            // liga a linha de lista ao card do trilho como sendo o mesmo
            // objeto, visto de outro jeito.
            DecoratedBox(
              position: DecorationPosition.foreground,
              decoration: BoxDecoration(
                borderRadius: _thumbCornerRadius,
                border: Border.all(
                  color: (event.isHappeningNow ? colors.live : colors.ambar)
                      .withValues(alpha: event.isHappeningNow ? 1 : 0.55),
                  width: AppStroke.hairline,
                ),
              ),
              child: ClipRRect(
                borderRadius: _thumbCornerRadius,
                child: SizedBox(width: 76, height: 76, child: _image(context)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Bloco de data em DM Mono — dia grande, mês pequeno, traço vertical em
/// `brasa` do lado. É a peça de "sistema" que ancora a lista vertical: o olho
/// desce pelos números, não pelos títulos.
class _DateBlock extends StatelessWidget {
  final EventModel event;

  const _DateBlock({required this.event});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final today = event.isToday;

    return SizedBox(
      width: 54,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // O traço vertical era cinza fora do dia de hoje, o que deixava a
          // lista inteira sem cor. Agora ele é sempre da marca: `brasa` no
          // que é hoje, `ambar` em meia força no resto.
          Container(
            width: AppStroke.marker,
            constraints: const BoxConstraints(minHeight: 44),
            color: today ? colors.brasa : colors.ambar.withValues(alpha: 0.55),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  event.dataDoEvento.day.toString().padLeft(2, '0'),
                  style: type.monoDisplay.copyWith(
                    color: today ? colors.brasa : colors.textPrimary,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  event.dayLabel.length <= 6
                      ? event.dayLabel
                      : event.dayLabel.split(' ').first,
                  style: type.monoMicro.copyWith(color: colors.textMuted),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
