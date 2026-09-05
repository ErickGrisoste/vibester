import 'package:flutter/material.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/auth_storage_service.dart';
import 'package:mobile/screens/onboarding/final_onboarding_screen.dart';
import 'package:mobile/screens/onboarding/initial_onboarding_screen.dart';
import 'package:mobile/screens/onboarding/onboarding_central_one_screen.dart';

// ===========================================================================
// HOST DO ONBOARDING
// Segura as tres telas num PageView. Como as tres vivem dentro da mesma rota,
// "voltar" sempre cai na pagina anterior, independente de o usuario ter
// chegado ali pelo "Proximo" ou pelo "Pular".
// ===========================================================================
class OnboardingScreen extends StatefulWidget {
  const OnboardingScreen({super.key});

  @override
  State<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends State<OnboardingScreen> {
  static const _lastPage = 2;
  static const _duration = Duration(milliseconds: 320);
  static const _curve = Curves.easeOutCubic;

  final _controller = PageController();
  int _page = 0;

  void _next() => _controller.nextPage(duration: _duration, curve: _curve);

  void _back() => _controller.previousPage(duration: _duration, curve: _curve);

  // Fim do onboarding: descarta esta rota para que a home fique sendo a
  // unica da pilha, igual ao fluxo de login.
  Future<void> _finish() async {
    await AuthStorageService.concluirOnboarding();
    if (!mounted) return;

    Navigator.pushNamedAndRemoveUntil(
      context,
      AppRoutes.home,
      (route) => false,
    );
  }

  // jumpToPage em vez de animateToPage: da tela 1 o animate passaria varrendo
  // a tela 2 no caminho, o que fica estranho num "Pular".
  void _skip() => _controller.jumpToPage(_lastPage);

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return PopScope(
      // O onboarding e a unica rota da pilha neste ponto, entao deixar o
      // voltar passar fecharia o app. Ele so recua de pagina.
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop) return;
        if (_page > 0) _back();
      },
      child: PageView(
        controller: _controller,
        onPageChanged: (index) => setState(() => _page = index),
        children: [
          InitialOnboardingScreen(onNext: _next, onSkip: _skip),
          OnboardingCentralOneScreen(
            onNext: _next,
            onBack: _back,
            onSkip: _skip,
          ),
          FinalOnboardingScreen(onBack: _back, onStart: _finish),
        ],
      ),
    );
  }
}