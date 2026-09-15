import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/screens/register/register_screen.dart';
import 'package:mobile/screens/register/reset_password_screen.dart';
import 'package:mobile/screens/settings/delete_account_screen.dart';
import 'package:mobile/screens/settings/settings_screen.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:pinput/pinput.dart';

import '../helpers/pump_app.dart';

class _FakeUserService extends UserService {
  final List<String> deletedWith = [];
  final List<Map<String, String>> resets = [];

  @override
  Future<void> deleteAccount({required String password}) async {
    deletedWith.add(password);
  }

  @override
  Future<void> resetPassword({
    required String email,
    required String code,
    required String password,
  }) async {
    resets.add({'email': email, 'code': code, 'password': password});
  }

  @override
  Future<void> requestPasswordReset({required String email}) async {}
}

void main() {
  setUpAll(() async {
    await setUpTestEnvironment();
    // O logout depois da exclusão limpa a sessão no armazenamento seguro.
    FlutterSecureStorage.setMockInitialValues({});
  });

  testWidgets('Ajustes oferece contato, termos, privacidade, bloqueios e '
      'exclusão — e não oferece mais o Vibester Club', (tester) async {
    await pumpScreen(
      tester,
      const SettingsScreen(),
      size: const Size(390, 1600),
      user: fakeUser(),
    );

    expect(find.text('Contas bloqueadas'), findsOneWidget);
    expect(find.text('Ajuda e contato'), findsOneWidget);
    expect(find.text('contato@vibester.com.br'), findsOneWidget);
    expect(find.text('Termos de Uso'), findsOneWidget);
    expect(find.text('Política de Privacidade'), findsOneWidget);
    expect(find.text('Excluir conta'), findsOneWidget);
    expect(find.textContaining('Vibester Club'), findsNothing);
    expect(find.textContaining('Ghost'), findsNothing);
  });

  testWidgets('Excluir conta pede a senha antes de chamar a API', (
    tester,
  ) async {
    final service = _FakeUserService();
    await pumpScreen(
      tester,
      DeleteAccountScreen(userService: service),
      size: const Size(390, 1200),
      user: fakeUser(),
    );

    await tester.tap(find.text('Excluir minha conta'));
    await tester.pump();

    expect(find.text('Digite sua senha para confirmar'), findsOneWidget);
    expect(service.deletedWith, isEmpty);

    await tester.enterText(find.byType(TextField), 'minhaSenha1');
    await tester.tap(find.text('Excluir minha conta'));
    await tester.pumpAndSettle();

    // Confirmação dupla: nada é apagado sem o segundo "sim".
    expect(find.text('Excluir de vez?'), findsOneWidget);
    expect(service.deletedWith, isEmpty);

    await tester.tap(find.text('Excluir conta'));
    // Pumps com tempo em vez de pumpAndSettle: a transição de rota e o
    // spinner do botão não precisam "assentar" para a asserção valer.
    await tester.pump();
    await tester.pump(const Duration(seconds: 1));
    await tester.pump(const Duration(seconds: 1));

    expect(service.deletedWith, ['minhaSenha1']);
    // Saiu da tela: a exclusão leva de volta ao início.
    expect(find.text('Excluir minha conta'), findsNothing);
  });

  testWidgets('Nova senha exige código completo e senhas iguais', (
    tester,
  ) async {
    final service = _FakeUserService();
    await pumpScreen(
      tester,
      ResetPasswordScreen(email: 'ana@example.com', userService: service),
      size: const Size(390, 1200),
    );

    // O email vem dentro de um Text.rich.
    expect(
      find.textContaining('ana@example.com', findRichText: true),
      findsOneWidget,
    );
    expect(find.textContaining('REENVIAR CÓDIGO'), findsOneWidget);

    await tester.tap(find.text('Redefinir senha'));
    await tester.pump();
    expect(find.text('Informe a nova senha'), findsOneWidget);
    expect(service.resets, isEmpty);

    // O Pinput tem EditableText próprio; os TextField são as duas senhas.
    final codigo = find.descendant(
      of: find.byType(Pinput),
      matching: find.byType(EditableText),
    );
    final senhas = find.byType(TextField);
    await tester.enterText(codigo, '123456');
    await tester.enterText(senhas.at(0), 'novaSenha1');
    await tester.enterText(senhas.at(1), 'outraSenha');
    await tester.tap(find.text('Redefinir senha'));
    await tester.pump();
    expect(find.text('As senhas não são iguais'), findsOneWidget);

    await tester.enterText(senhas.at(1), 'novaSenha1');
    await tester.tap(find.text('Redefinir senha'));
    await tester.pump();

    expect(service.resets, [
      {'email': 'ana@example.com', 'code': '123456', 'password': 'novaSenha1'},
    ]);
  });

  testWidgets('Cadastro não segue sem aceitar os termos', (tester) async {
    await pumpScreen(tester, const RegisterScreen(), size: const Size(390, 1600));

    expect(find.textContaining('Termos de Uso'), findsWidgets);
    await tester.tap(find.text('Criar conta'));
    await tester.pump();

    expect(
      find.text('Para criar a conta, aceite os Termos e a Política'),
      findsOneWidget,
    );
  });
}
