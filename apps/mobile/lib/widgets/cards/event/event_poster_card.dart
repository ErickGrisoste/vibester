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
  /// Cartaz alto de destaque, um por vez no trilho horizontal da Home.
  hero,

  /// Cartaz pequeno para trilho horizontal denso.
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
/// A quina inferior esquerda fica reta enquanto as outras são arredondadas:
/// é o "canto rasgado" do cartaz, e é o detalhe que faz o card ser
/// reconhecível como Vibester mesmo sem cor de marca à vista.
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

  static const _cornerRadius = BorderRadius.only(
    topLeft: Radius.circular(AppRadius.md),
    topRight: Radius.circular(AppRadius.md),
    bottomRight: Radius.circular(AppRadius.md),
  );

  /// Mesmo "canto rasgado", em escala menor — miniatura da variante `wide`.
  static const _thumbCornerRadius = BorderRadius.only(
    topLeft: Radius.circular(AppRadius.sm),
    topRight: Radius.circular(AppRadius.sm),
    bottomRight: Radius.circular(AppRadius.sm),
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
        EventCardVariant.hero => _buildPoster(context, tall: true),
        EventCardVariant.compact => _buildPoster(context, tall: false),
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

  Widget _buildPoster(BuildContext context, {required bool tall}) {
    final colors = context.colors;
    final type = context.typography;
    final happening = event.isHappeningNow;

    return SizedBox(
      width: width ?? (tall ? 300 : 168),
      child: AspectRatio(
        aspectRatio: tall ? 3 / 4 : 3 / 4.3,
        // Sem borda: profundidade vem de uma sombra suave por baixo do
        // cartaz, não de um contorno em volta dele — a imagem continua sendo
        // o limite visual do card.
        child: DecoratedBox(
          decoration: BoxDecoration(
            borderRadius: _cornerRadius,
            boxShadow: [
              BoxShadow(
                color: colors.scrim.withValues(alpha: 0.32),
                blurRadius: 22,
                offset: const Offset(0, 12),
              ),
            ],
          ),
          child: ClipRRect(
            borderRadius: _cornerRadius,
            child: Stack(
              fit: StackFit.expand,
              children: [
                _image(context),

                // Scrim de leitura + grão: o grão é o que impede a foto de
                // parecer um banner de stock e amarra o card à textura do resto
                // do app.
                const Grain(opacity: 0.06, density: 0.4),
                DecoratedBox(
                  decoration: BoxDecoration(gradient: colors.photoScrim),
                ),

                // Selo urgente no topo — só quando o horário sustenta.
                if (happening)
                  const Positioned(
                    top: AppSpacing.md,
                    left: AppSpacing.md,
                    child: StickerTag.live(),
                  )
                else if (event.isToday)
                  const Positioned(
                    top: AppSpacing.md,
                    left: AppSpacing.md,
                    child: StickerTag(label: 'HOJE'),
                  ),

                Positioned(
                  left: AppSpacing.md,
                  right: AppSpacing.md,
                  bottom: AppSpacing.md,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (event.categoria.isNotEmpty && tall) ...[
                        VibesterTag(event.categoria),
                        const SizedBox(height: AppSpacing.sm),
                      ],
                      Text(
                        event.titulo,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style:
                            (tall ? type.headlineMedium : type.headlineSmall)
                                .copyWith(color: Colors.white),
                      ),
                      const SizedBox(height: AppSpacing.xs + 2),
                      Text(
                        event.metaLine(includeLocation: tall),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: type.monoSmall.copyWith(
                          color: happening
                              ? colors.brasa
                              : Colors.white.withValues(alpha: 0.75),
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
                  Text(
                    event.titulo,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: type.headlineSmall.copyWith(
                      color: colors.textPrimary,
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
            ClipRRect(
              borderRadius: _thumbCornerRadius,
              child: SizedBox(width: 76, height: 76, child: _image(context)),
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
          Container(
            width: AppStroke.marker,
            constraints: const BoxConstraints(minHeight: 44),
            color: today ? colors.brasa : colors.hairline,
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
