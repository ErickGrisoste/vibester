import 'package:mobile/models/onboarding/onboarding_slide.dart';

/// A história do onboarding, em ordem: **problema → eventos → lugares →
/// descoberta**.
///
/// O Vibester é apresentado pelo que ele resolve, não como lista de
/// funcionalidades — a funcionalidade aparece como consequência ("tá tudo
/// aqui"), nunca como tutorial ("aqui você pode…"). Quem passa pelas quatro
/// páginas tem que conseguir dizer o que é o app, que problema ele resolve, o
/// que tem dentro e por que usar.
///
/// Copy, ordem e visual de cada página mudam só aqui. A última página é a que
/// pede localização (ver `OnboardingScreen._finish`), por isso o texto dela
/// avisa o motivo antes do pedido nativo aparecer.
const onboardingSlides = <OnboardingSlide>[
  OnboardingSlide(
    eyebrow: '01 — O CORRE',
    headline: ['SEM SABER', 'O QUE FAZER', 'HOJE?'],
    body:
        'O rolê tá espalhado em story, grupo, flyer e perfil de bar. '
        'Achar algo bom vira uma busca sem fim.',
    cta: 'Bora',
    visual: OnboardingVisual.scattered,
  ),
  OnboardingSlide(
    eyebrow: '02 — EVENTOS',
    headline: ['OS EVENTOS', 'DA CIDADE', 'NUM LUGAR SÓ'],
    body:
        'Veja o que tá acontecendo sem caçar evento por evento — '
        'hoje, amanhã e no fim de semana.',
    cta: 'Próximo',
    visual: OnboardingVisual.events,
  ),
  OnboardingSlide(
    eyebrow: '03 — LUGARES',
    headline: ['NÃO SABE', 'ONDE IR?'],
    body:
        'Bares, baladas, restaurantes e lounges pra transformar uma ideia '
        'num rolê — com o movimento de cada um.',
    cta: 'Próximo',
    visual: OnboardingVisual.places,
  ),
  OnboardingSlide(
    eyebrow: '04 — QUAL É A BOA?',
    headline: ['SEU PRÓXIMO', 'ROLÊ COMEÇA', 'AQUI'],
    body:
        'Descobre, escolhe e vai. Com a sua localização a gente mostra o que '
        'tá perto — sem ela, o app funciona igual.',
    cta: 'Começar a explorar',
    visual: OnboardingVisual.discovery,
  ),
];
