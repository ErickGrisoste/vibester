import 'package:flutter/foundation.dart';
import 'package:mobile/models/user/interest_model.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Persistência local dos interesses escolhidos no onboarding.
///
/// É **local de propósito**: não existe endpoint de interesses do usuário nos
/// serviços atuais, e inventar uma chamada seria criar do lado do app uma
/// funcionalidade que o backend não tem. Enquanto isso, guardar a escolha no
/// aparelho já resolve o problema real que existia — o usuário selecionava as
/// vibes dele e a escolha morria na saída da tela, sem sobreviver nem à
/// próxima abertura do app.
///
/// Vai em `SharedPreferences`, e não no armazenamento seguro: preferência de
/// categoria não é credencial, e o `flutter_secure_storage` fica reservado
/// para a sessão (ver `AuthStorageService`).
class InterestsStorage {
  InterestsStorage._();

  static const _key = 'user_interests';

  /// Grava os ids selecionados em [defaultInterests].
  static Future<void> save(List<Interest> interests) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final selected = interests
          .where((i) => i.selected)
          .map((i) => i.id)
          .toList();
      await prefs.setStringList(_key, selected);
    } catch (e) {
      debugPrint('Não foi possível salvar interesses: $e');
    }
  }

  /// Aplica a seleção salva sobre [defaultInterests]. Chamado uma vez no boot,
  /// antes de a primeira tela ser construída.
  static Future<void> restore() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getStringList(_key);
      if (saved == null) return;

      for (final interest in defaultInterests) {
        interest.selected = saved.contains(interest.id);
      }
    } catch (e) {
      debugPrint('Não foi possível ler interesses: $e');
    }
  }

  /// Interesses marcados, na ordem original da lista.
  static List<Interest> get selected =>
      defaultInterests.where((i) => i.selected).toList();
}
