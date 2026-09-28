import 'package:flutter/material.dart';
import 'package:mobile/providers/events/events_list_provider.dart';
import 'package:mobile/providers/place/nearby_provider.dart';
import 'package:mobile/providers/place/place_list_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/screens/onboarding/onboarding_content.dart';
import 'package:mobile/service/auth_storage_service.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/graffiti/spray_glow.dart';
import 'package:mobile/widgets/onboarding/onboarding_footer.dart';
import 'package:mobile/widgets/onboarding/onboarding_slide_view.dart';
import 'package:provider/provider.dart';

// ===========================================================================
// ONBOARDING — última etapa do cadastro (`EtapaCadastro.apresentacao`).
//
// Conta uma história em quatro páginas (`onboarding_content.dart`): o rolê
// espalhado → os eventos num lugar só → os lugares → "qual é a boa?". Fundo,
// luz e rodapé ficam fora do `PageView` e não trocam de página: só o conteúdo
// passa, e a luz viaja de uma posição para a outra acompanhando o dedo.
//
// Como tudo vive na mesma rota, "voltar" sempre recua uma página, e o
// "pular" leva à última — é nela que a localização é pedida com o motivo
// explicado, então nem quem pula deixa de ver por que o app quer o GPS.
// ===========================================================================
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  static const _curve = Curves.easeInOutCubic;

  final _controller = PageController();
  final _revealed = <int>{};
  int _page = 0;
  bool _asking = false;

  int get _lastPage => onboardingSlides.length - 1;

  @override
  void initState() {
    super.initState();
    // A sessão já existe aqui (o onboarding fecha o cadastro), então as
    // páginas 2 e 3 mostram eventos e lugares reais. As buscas respeitam a
    // janela de staleness dos providers e deixam a Home com cache quente.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<EventsListProvider>().fetchEvents();
      context.read<PlaceListProvider>().fetchPlaces();
    });
  }

  void _goTo(int page) {
    if (AppMotion.reduceMotion(context)) {
      _controller.jumpToPage(page);
      return;
    }
    _controller.animateToPage(
      page,
      // Um pouco mais longo que a troca de tela padrão: aqui a transição é
      // parte da narrativa, e as camadas precisam de tempo para se separar.
      duration: AppMotion.expressive,
      curve: _curve,
    );
  }

  void _next() => _page >= _lastPage ? _finish() : _goTo(_page + 1);

  void _back() => _goTo(_page - 1);

  // jumpToPage em vez de animar: de uma página no início, a animação varreria
  // as do meio no caminho, o que fica estranho num "pular".
  void _skip() => _controller.jumpToPage(_lastPage);

  // Fim do onboarding: pede a localização (o provider trata negada e GPS
  // desligado como "sem localização" — nada aqui bloqueia a entrada), fecha
  // o cadastro e descarta esta rota para a home ser a única da pilha.
  Future<void> _finish() async {
    if (_asking) return;
    setState(() => _asking = true);

    await context.read<NearbyProvider>().load(force: true);
    await AuthStorageService.concluirCadastro();
    if (!mounted) return;

    Navigator.pushNamedAndRemoveUntil(
      context,
      AppRoutes.home,
      (route) => false,
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final slide = onboardingSlides[_page];

    return PopScope(
      // O onboarding é a única rota da pilha neste ponto, então deixar o
      // voltar passar fecharia o app. Ele só recua de página.
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (_page > 0) _back();
      },
      child: Scaffold(
        backgroundColor: colors.noturno,
        body: Stack(
          children: [
            Positioned.fill(child: _TravelingGlow(pages: _controller)),
            const Positioned.fill(child: Grain(opacity: 0.05, density: 0.5)),
            SafeArea(
              child: Column(
                children: [
                  Expanded(
                    child: PageView.builder(
                      controller: _controller,
                      itemCount: onboardingSlides.length,
                      onPageChanged: (index) => setState(() => _page = index),
                      itemBuilder: (context, index) => OnboardingSlideView(
                        slide: onboardingSlides[index],
                        index: index,
                        pages: _controller,
                        revealed: _revealed.contains(index),
                        onRevealed: () => _revealed.add(index),
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.only(
                      left: AppSpacing.screen,
                      right: AppSpacing.screen,
                      top: AppSpacing.xl,
                    ),
                    child: OnboardingFooter(
                      pages: _controller,
                      page: _page,
                      total: onboardingSlides.length,
                      ctaLabel: slide.cta,
                      onNext: _next,
                      onSkip: _page < _lastPage ? _skip : null,
                      busy: _asking,
                    ),
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

/// A luz de fundo, uma só para as quatro páginas.
///
/// Cada página tem um ponto e uma cor (âmbar ou brasa); entre elas, posição e
/// cor são interpoladas pela posição do `PageController`. A mancha
/// atravessa a tela junto com o gesto — é a continuidade de "um lugar só" no
/// nível mais baixo da composição, e custa um gradiente radial por frame.
class _TravelingGlow extends StatelessWidget {
  final PageController pages;

  const _TravelingGlow({required this.pages});

  /// Centro da mancha em fração da tela, por página.
  static const _anchors = [
    Offset(0.12, 0.18),
    Offset(0.92, 0.3),
    Offset(0.08, 0.42),
    Offset(0.5, 0.26),
  ];

  static const _glowSize = 340.0;
  static const _stretch = 1.4;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final tones = [colors.ambar, colors.brasa, colors.ambar, colors.brasa];

    return LayoutBuilder(
      builder: (context, constraints) => AnimatedBuilder(
        animation: pages,
        builder: (context, _) {
          final position = pages.hasClients && pages.position.haveDimensions
              ? (pages.page ?? 0).clamp(0.0, _anchors.length - 1.0)
              : 0.0;
          final from = position.floor();
          final to = (from + 1).clamp(0, _anchors.length - 1);
          final t = position - from;

          final anchor = Offset.lerp(_anchors[from], _anchors[to], t)!;
          final center = Offset(
            anchor.dx * constraints.maxWidth,
            anchor.dy * constraints.maxHeight,
          );

          return Stack(
            children: [
              Positioned(
                left: center.dx - _glowSize * _stretch / 2,
                top: center.dy - _glowSize / 2,
                child: SprayGlow(
                  color: Color.lerp(tones[from], tones[to], t)!,
                  size: _glowSize,
                  stretch: _stretch,
                  intensity: 0.19,
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
