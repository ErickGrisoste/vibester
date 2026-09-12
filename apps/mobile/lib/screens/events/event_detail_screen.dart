import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/event/event_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/event_time.dart';
import 'package:mobile/utils/hero_tags.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/cards/users/map_event.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_tag.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/sticker_tag.dart';
import 'package:mobile/widgets/indicators/lineup_indicator.dart';
import 'package:mobile/widgets/motion/staggered_entrance.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

/// Detalhe do evento.
///
/// Reescrita a partir de uma tela que empilhava caixa dentro de caixa (um
/// `Container` com gradiente dentro de um `Stack` dentro de um `SizedBox`
/// com altura proporcional, e as informações básicas dentro de um card
/// arredondado com divisórias internas). A versão nova segue a regra do
/// briefing — a interface respira, e a informação vive sobre o fundo, não
/// dentro de molduras:
///
/// * **Cartaz em tela cheia** com paralaxe no scroll, e o título saindo de
///   cima dele. A imagem é a mesma do card de origem, então a transição
///   `Hero` continua a arte de onde o usuário tocou.
/// * **Ficha técnica em DM Mono**, em linhas separadas por fio de 1px — sem
///   card, sem fundo, sem borda arredondada.
/// * **CTA fixo no rodapé**, na zona do polegar, sempre visível: a decisão de
///   ir não pode depender de rolar até o fim da página.
///
/// Nada aqui inventa dado: "quem vai" mostra `totalConfirmed` como veio da
/// API, o botão de ingresso só existe quando há `ticketLink`, e o line-up só
/// aparece quando a API mandou artistas.
class EventDetailScreen extends StatefulWidget {
  final EventModel eventModel;

  const EventDetailScreen({super.key, required this.eventModel});

  @override
  State<EventDetailScreen> createState() => _EventDetailScreenState();
}

class _EventDetailScreenState extends State<EventDetailScreen> {
  final EventService _eventService = EventService();
  late EventModel _event = widget.eventModel;
  bool _isTogglingPresence = false;

  @override
  void initState() {
    super.initState();
    _carregarStatusDePresenca();
  }

  Future<void> _carregarStatusDePresenca() async {
    final userId = context.read<UserProvider>().user?.accountId;
    final eventId = _event.id;
    if (userId == null || eventId == null) return;

    final checkedIn = await _eventService.getCheckInStatus(
      eventId: eventId,
      userId: userId,
    );

    if (mounted) {
      setState(() => _event = _event.copyWith(isFavorite: checkedIn));
    }
  }

  /// Confirmação otimista: o estado e o contador mudam antes da resposta da
  /// API e só voltam atrás em erro real — 409 significa que o servidor já
  /// está no estado pretendido (corrida com outra tela), então não é erro.
  Future<void> _alternarPresenca() async {
    final userId = context.read<UserProvider>().user?.accountId;
    final eventId = _event.id;
    if (userId == null || eventId == null || _isTogglingPresence) return;

    final confirmadoAntes = _event.isFavorite;
    setState(() {
      _isTogglingPresence = true;
      _event = _event.copyWith(
        isFavorite: !confirmadoAntes,
        totalConfirmed: confirmadoAntes
            ? _event.totalConfirmed - 1
            : _event.totalConfirmed + 1,
      );
    });

    try {
      if (confirmadoAntes) {
        await _eventService.checkOut(eventId: eventId, userId: userId);
      } else {
        await _eventService.checkIn(eventId: eventId, userId: userId);
      }
    } catch (e) {
      final is409 = e.toString().contains('409');
      if (!is409 && mounted) {
        setState(() {
          _event = _event.copyWith(
            isFavorite: confirmadoAntes,
            totalConfirmed: _event.totalConfirmed + (confirmadoAntes ? 1 : -1),
          );
        });
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não deu pra confirmar agora')),
        );
      }
    } finally {
      if (mounted) setState(() => _isTogglingPresence = false);
    }
  }

  Future<void> _compartilhar() async {
    final texto = [
      _event.titulo,
      '${_event.fullDateLabel} · ${_event.timeLabel}',
      if (_event.localizacao.isNotEmpty) _event.localizacao,
      'Visto no Vibester',
    ].join('\n');

    await SharePlus.instance.share(ShareParams(text: texto));
  }

  Future<void> _abrirIngresso() async {
    final uri = Uri.tryParse(_event.ticketLink);
    if (uri == null) return;

    final aberto = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!aberto && mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível abrir o link')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final hasTicket = _event.ticketLink.isNotEmpty;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              _EventHero(event: _event, onShare: _compartilhar),

              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(
                    AppSpacing.screen,
                    AppSpacing.xl,
                    AppSpacing.screen,
                    0,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      StaggeredEntrance(
                        index: 0,
                        child: _FactSheet(event: _event),
                      ),

                      if (_event.totalConfirmed > 0)
                        StaggeredEntrance(
                          index: 1,
                          child: _Confirmed(count: _event.totalConfirmed),
                        ),

                      if (_event.artistas.isNotEmpty ||
                          (_event.lineUp?.isNotEmpty ?? false))
                        StaggeredEntrance(
                          index: 2,
                          child: _Block(
                            label: 'LINE-UP',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                if (_event.artistas.isNotEmpty)
                                  Text(
                                    _event.artistas,
                                    style: type.headlineSmall.copyWith(
                                      color: colors.textPrimary,
                                    ),
                                  ),
                                if (_event.lineUp?.isNotEmpty ?? false) ...[
                                  const SizedBox(height: AppSpacing.md),
                                  LineupIndicator(lineup: _event.lineUp),
                                ],
                              ],
                            ),
                          ),
                        ),

                      if (_event.informacoes.isNotEmpty)
                        StaggeredEntrance(
                          index: 3,
                          child: _Block(
                            label: 'O QUE ROLA',
                            child: Text(
                              _event.informacoes,
                              style: type.bodyLarge.copyWith(
                                color: colors.textSecondary,
                              ),
                            ),
                          ),
                        ),

                      if (_event.localizacao.isNotEmpty)
                        StaggeredEntrance(
                          index: 4,
                          child: _Block(
                            label: 'ONDE É',
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _event.localizacao,
                                  style: type.headlineSmall.copyWith(
                                    color: colors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: AppSpacing.md),
                                ClipRRect(
                                  borderRadius: AppRadius.mdAll,
                                  child: MapEvent(endereco: _event.localizacao),
                                ),
                                if (_event.placeId != null) ...[
                                  const SizedBox(height: AppSpacing.md),
                                  VibesterButton(
                                    label: 'Ver o estabelecimento',
                                    icon: Icons.storefront_outlined,
                                    variant: VibesterButtonVariant.outline,
                                    compact: true,
                                    onPressed: () => Navigator.pushNamed(
                                      context,
                                      AppRoutes.placeDetail,
                                      arguments: _event.placeId,
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),

                      if (_event.organizador.isNotEmpty)
                        _Block(
                          label: 'QUEM FAZ',
                          child: Text(
                            _event.organizador,
                            style: type.bodyLarge.copyWith(
                              color: colors.textSecondary,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),

              // Espaço para a barra de ação fixa não cobrir o último bloco.
              const SliverPadding(padding: EdgeInsets.only(bottom: 140)),
            ],
          ),

          Align(
            alignment: Alignment.bottomCenter,
            child: _ActionBar(
              event: _event,
              busy: _isTogglingPresence,
              onPresence: _alternarPresenca,
              onTicket: hasTicket ? _abrirIngresso : null,
            ),
          ),
        ],
      ),
    );
  }
}

// -----------------------------------------------------------------------
// Cartaz
// -----------------------------------------------------------------------

/// Cabeçalho em cartaz com paralaxe: a imagem sobe a metade da velocidade do
/// scroll, então a página parece deslizar *sobre* o cartaz — o mesmo efeito
/// de virar uma folha colada por cima de outra.
class _EventHero extends StatelessWidget {
  final EventModel event;
  final VoidCallback onShare;

  const _EventHero({required this.event, required this.onShare});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final height = MediaQuery.of(context).size.height * 0.52;

    return SliverAppBar(
      pinned: false,
      floating: false,
      expandedHeight: height,
      backgroundColor: colors.noturno,
      surfaceTintColor: Colors.transparent,
      automaticallyImplyLeading: false,
      stretch: true,
      flexibleSpace: FlexibleSpaceBar(
        stretchModes: const [StretchMode.zoomBackground],
        background: Stack(
          fit: StackFit.expand,
          children: [
            Hero(
              tag: eventImageHeroTag(event),
              child: VibesterImage(
                source: event.imageUrl,
                alignment: Alignment.topCenter,
                placeholderIcon: Icons.local_activity_outlined,
              ),
            ),
            const Grain(opacity: 0.07, density: 0.45),
            DecoratedBox(
              decoration: BoxDecoration(gradient: colors.photoScrim),
            ),

            Positioned(
              left: AppSpacing.screen,
              right: AppSpacing.screen,
              bottom: AppSpacing.xl,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      if (event.isHappeningNow)
                        const StickerTag.live()
                      else if (event.categoria.isNotEmpty)
                        VibesterTag(event.categoria, tone: TagTone.brand),
                    ],
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(
                    event.titulo,
                    style: type.displayLarge.copyWith(color: Colors.white),
                  ),
                ],
              ),
            ),

            // Ações flutuantes com o padding do topo respeitado.
            Positioned(
              top: MediaQuery.of(context).padding.top + AppSpacing.sm,
              left: AppSpacing.lg,
              right: AppSpacing.lg,
              child: Row(
                children: [
                  _GlassAction(
                    icon: Icons.arrow_back_rounded,
                    label: 'Voltar',
                    onTap: () => Navigator.maybePop(context),
                  ),
                  const Spacer(),
                  _GlassAction(
                    icon: Icons.ios_share_rounded,
                    label: 'Compartilhar',
                    onTap: onShare,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Botão sobre foto. Fundo escuro sólido em vez de `BackdropFilter`: blur em
/// cima de imagem grande custa uma passada de GPU por frame durante o scroll,
/// e o ganho visual aqui seria zero.
class _GlassAction extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback onTap;

  const _GlassAction({
    required this.icon,
    required this.label,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      child: VibesterPressable(
        onTap: onTap,
        borderRadius: AppRadius.pillAll,
        child: Container(
          width: 44,
          height: 44,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: context.colors.scrim.withValues(alpha: 0.55),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white.withValues(alpha: 0.14)),
          ),
          child: Icon(icon, size: 20, color: Colors.white),
        ),
      ),
    );
  }
}

// -----------------------------------------------------------------------
// Conteúdo
// -----------------------------------------------------------------------

/// Ficha técnica: linhas de rótulo/valor separadas por fio. É a peça mais
/// "sistema" da tela, então é toda em DM Mono do lado do rótulo e em Outfit
/// do lado do valor — a mesma divisão de vozes do resto do produto.
class _FactSheet extends StatelessWidget {
  final EventModel event;

  const _FactSheet({required this.event});

  @override
  Widget build(BuildContext context) {
    final countdown = event.countdownLabel;

    return Column(
      children: [
        _FactRow(
          label: 'QUANDO',
          value: event.fullDateLabel.toUpperCase(),
          trailing: countdown,
        ),
        _FactRow(label: 'HORA', value: event.timeLabel.toUpperCase()),
        if (event.localizacao.isNotEmpty)
          _FactRow(label: 'ONDE', value: event.localizacao.toUpperCase()),
      ],
    );
  }
}

class _FactRow extends StatelessWidget {
  final String label;
  final String value;
  final String? trailing;

  const _FactRow({required this.label, required this.value, this.trailing});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Container(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.md + 2),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.hairline)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 78,
            child: Text(
              label,
              style: context.typography.monoMicro.copyWith(
                color: colors.textDisabled,
              ),
            ),
          ),
          Expanded(
            child: Text(
              value,
              style: context.typography.titleMedium.copyWith(
                color: colors.textPrimary,
              ),
            ),
          ),
          if (trailing != null) ...[
            const SizedBox(width: AppSpacing.sm),
            VibesterTag(trailing!, tone: TagTone.live),
          ],
        ],
      ),
    );
  }
}

/// Prova social real: o número vem de `totalConfirmed`, da API. Sem avatares
/// inventados e sem "muita gente vai" — se o backend não sabe quem são, a
/// tela não finge saber.
class _Confirmed extends StatelessWidget {
  final int count;

  const _Confirmed({required this.count});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xl),
      child: Row(
        children: [
          Text(
            count.toString().padLeft(2, '0'),
            style: context.typography.monoDisplay.copyWith(color: colors.ambar),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Text(
              count == 1
                  ? 'pessoa confirmou presença'
                  : 'pessoas confirmaram presença',
              style: context.typography.bodyMedium.copyWith(
                color: colors.textMuted,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Bloco de conteúdo com rótulo mono. Sem card: só o rótulo, o respiro e o
/// texto.
class _Block extends StatelessWidget {
  final String label;
  final Widget child;

  const _Block({required this.label, required this.child});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xxl),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: context.typography.monoEyebrow.copyWith(
              color: context.colors.ambar,
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          child,
        ],
      ),
    );
  }
}

/// Barra de ação fixa no rodapé. Uma ação principal (confirmar presença) e,
/// quando existe link, uma secundária ao lado — nunca dois botões do mesmo
/// peso disputando o polegar.
class _ActionBar extends StatelessWidget {
  final EventModel event;
  final bool busy;
  final VoidCallback onPresence;
  final VoidCallback? onTicket;

  const _ActionBar({
    required this.event,
    required this.busy,
    required this.onPresence,
    this.onTicket,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final confirmed = event.isFavorite;

    return Container(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.screen,
        AppSpacing.md,
        AppSpacing.screen,
        MediaQuery.of(context).padding.bottom + AppSpacing.md,
      ),
      decoration: BoxDecoration(
        color: colors.noturno,
        border: Border(top: BorderSide(color: colors.hairline)),
      ),
      child: Row(
        children: [
          Expanded(
            child: VibesterButton(
              label: 'Vou nessa',
              successLabel: 'Presença confirmada',
              icon: Icons.bolt_rounded,
              variant: confirmed
                  ? VibesterButtonVariant.outline
                  : VibesterButtonVariant.accent,
              state: busy
                  ? VibesterButtonState.loading
                  : confirmed
                  ? VibesterButtonState.success
                  : VibesterButtonState.idle,
              onPressed: onPresence,
            ),
          ),
          if (onTicket != null) ...[
            const SizedBox(width: AppSpacing.md),
            Semantics(
              button: true,
              label: 'Garantir ingresso',
              child: VibesterPressable(
                onTap: onTicket,
                borderRadius: AppRadius.pillAll,
                child: Container(
                  width: 56,
                  height: 56,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.ambar,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    Icons.confirmation_number_outlined,
                    color: colors.onAmbar,
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
