import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/settings_row.dart';

/// Gerenciamento de conta.
///
/// Os dois itens desta tela ainda não têm destino no app (ambos tinham
/// `onTap: () {}`), então aparecem marcados como "EM BREVE" em vez de fingir
/// que abrem alguma coisa — mesma regra da tela de ajustes.
class AccountManagementSettingsScreen extends StatelessWidget {
  const AccountManagementSettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.noturno,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: AppSpacing.huge),
          children: const [
            ScreenHeader(
              title: 'Gerenciar\nconta',
              eyebrow: 'DADOS E ATIVIDADE',
            ),
            SettingsGroupLabel('DADOS E ATIVIDADE'),
            SettingsRow(
              icon: Icons.history_rounded,
              label: 'Histórico de vibe checks',
              comingSoon: true,
            ),
            SettingsRow(
              icon: Icons.link_rounded,
              label: 'Vincular e gerenciar contas',
              comingSoon: true,
            ),
          ],
        ),
      ),
    );
  }
}
