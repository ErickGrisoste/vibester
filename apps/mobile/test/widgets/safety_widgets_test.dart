import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/safety/blocked_profile.dart';
import 'package:mobile/models/safety/report_reason.dart';
import 'package:mobile/service/safety/safety_service.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/widgets/safety/report_sheet.dart';

import '../helpers/pump_app.dart';

class _RecordingSafetyService extends SafetyService {
  final List<Map<String, Object?>> reports = [];
  Exception? error;

  @override
  Future<void> report({
    required ReportTargetType targetType,
    required String targetId,
    String? targetOwnerId,
    required ReportReason reason,
    String? details,
  }) async {
    if (error != null) throw error!;
    reports.add({
      'targetType': targetType,
      'targetId': targetId,
      'targetOwnerId': targetOwnerId,
      'reason': reason,
      'details': details,
    });
  }

  @override
  Future<BlockedProfilesPage> listBlocked({String? cursor, int limit = 50}) async =>
      const BlockedProfilesPage(perfis: []);
}

Future<void> _abrirDenuncia(
  WidgetTester tester,
  SafetyService service,
) async {
  tester.view.physicalSize = const Size(390, 1400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.reset);

  await tester.pumpWidget(
    MaterialApp(
      theme: AppTheme.dark,
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () => showReportSheet(
                context,
                targetType: ReportTargetType.post,
                targetId: 'post-1',
                targetOwnerId: 'autor-1',
                service: service,
              ),
              child: const Text('abrir'),
            ),
          ),
        ),
      ),
    ),
  );

  await tester.tap(find.text('abrir'));
  await tester.pumpAndSettle();
}

void main() {
  setUpAll(setUpTestEnvironment);

  testWidgets('denúncia exige motivo e envia com o autor do post', (
    tester,
  ) async {
    final service = _RecordingSafetyService();
    await _abrirDenuncia(tester, service);

    expect(find.text('Denunciar publicação'), findsOneWidget);
    for (final motivo in ReportReason.values) {
      expect(find.text(motivo.label), findsOneWidget);
    }

    // Sem motivo o botão não envia.
    await tester.tap(find.text('Enviar denúncia'));
    await tester.pump();
    expect(service.reports, isEmpty);

    await tester.tap(find.text(ReportReason.harassment.label));
    await tester.pump();
    await tester.enterText(find.byType(TextField), '  xingou nos stories  ');
    await tester.tap(find.text('Enviar denúncia'));
    await tester.pumpAndSettle();

    expect(service.reports, hasLength(1));
    expect(service.reports.single, {
      'targetType': ReportTargetType.post,
      'targetId': 'post-1',
      'targetOwnerId': 'autor-1',
      'reason': ReportReason.harassment,
      'details': '  xingou nos stories  ',
    });
    expect(find.text('Denunciar publicação'), findsNothing);
    expect(
      find.text('Denúncia enviada. A gente analisa em até 24 horas.'),
      findsOneWidget,
    );
  });

  testWidgets('erro da API aparece na folha, que continua aberta', (
    tester,
  ) async {
    final service = _RecordingSafetyService()
      ..error = Exception('Não foi possível enviar a denúncia');
    await _abrirDenuncia(tester, service);

    await tester.tap(find.text(ReportReason.spam.label));
    await tester.pump();
    await tester.tap(find.text('Enviar denúncia'));
    await tester.pumpAndSettle();

    expect(find.text('Não foi possível enviar a denúncia'), findsOneWidget);
    expect(find.text('Denunciar publicação'), findsOneWidget);
  });
}
