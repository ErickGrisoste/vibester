import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

/// Endereços públicos que o app abre: termos, privacidade e suporte vivem na
/// `apps/landing-page`; o contato é uma caixa só.
class ExternalLinks {
  ExternalLinks._();

  static const contactEmail = 'contato@vibester.com.br';

  static final terms = Uri.parse('https://vibester.com.br/termos');
  static final privacy = Uri.parse('https://vibester.com.br/privacidade');
  static final support = Uri.parse('https://vibester.com.br/suporte');

  static Uri contactMail({String subject = 'Ajuda com o Vibester'}) =>
      Uri(scheme: 'mailto', path: contactEmail, query: 'subject=$subject');

  /// Abre páginas no navegador dentro do app (a pessoa não perde o lugar) e
  /// `mailto:` no app de email. Se nada abrir — simulador sem Mail, por
  /// exemplo —, avisa com [fallbackMessage] em vez de falhar calado.
  static Future<void> open(
    BuildContext context,
    Uri uri, {
    String fallbackMessage = 'Não foi possível abrir o link agora.',
  }) async {
    final messenger = ScaffoldMessenger.of(context);
    var opened = false;
    try {
      opened = await launchUrl(
        uri,
        mode: uri.scheme == 'mailto'
            ? LaunchMode.platformDefault
            : LaunchMode.inAppBrowserView,
      );
    } catch (e) {
      debugPrint('Falha ao abrir $uri: $e');
    }
    if (!opened) {
      messenger.showSnackBar(SnackBar(content: Text(fallbackMessage)));
    }
  }

  /// Contato: tenta o app de email e, sem ele, mostra o endereço.
  static Future<void> openContact(BuildContext context) => open(
    context,
    contactMail(),
    fallbackMessage: 'Escreve pra gente em $contactEmail',
  );
}
