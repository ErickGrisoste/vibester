import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:mobile/providers/theme/theme_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/payment/payment_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/theme/vibester_dialog.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/settings_row.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

/// Configurações.
///
/// A versão anterior desenhava cada grupo como um cartão arredondado de altura
/// fixa (`height: Platform.isIOS ? 190 : 150`) com divisórias internas — o que
/// quebra assim que o texto de um item quebra em duas linhas — e apresentava
/// como iguais tanto os itens que funcionavam quanto os oito que tinham
/// `onTap: () {}`. Aqui os grupos são apenas rótulos em DM Mono sobre linhas
/// separadas por fio, a altura vem do conteúdo, e **o que ainda não existe é
/// mostrado como não existente**: item apagado, sem toque, com o selo "EM
/// BREVE". Prometer um destino que não abre é pior que assumir que ele ainda
/// não está pronto.
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final PaymentService _paymentService = PaymentService();

  /// Preferência local de visibilidade, ainda sem contrapartida no backend.
  bool _modoFantasma = false;
  bool _carregandoCheckout = false;

  static const String _promocoesProductId = 'prod_g3JtzRb2TASCFuBYrQ2M4gTp';

  Future<void> _confirmarLogout() async {
    final colors = context.colors;

    final confirmar = await showVibesterDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.surfaceRaised,
        title: Text(
          'Sair da conta',
          style: context.typography.titleLarge.copyWith(
            color: colors.textPrimary,
          ),
        ),
        content: Text(
          'Você vai precisar entrar de novo pra usar o app.',
          style: context.typography.bodyMedium.copyWith(
            color: colors.textSecondary,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              'Cancelar',
              style: context.typography.titleSmall.copyWith(
                color: colors.textMuted,
              ),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              'Sair',
              style: context.typography.titleSmall.copyWith(
                color: colors.error,
              ),
            ),
          ),
        ],
      ),
    );

    if (confirmar != true || !mounted) return;

    await context.read<UserProvider>().logout();

    if (!mounted) return;
    Navigator.pushNamedAndRemoveUntil(
      context,
      AppRoutes.initialScreen,
      (_) => false,
    );
  }

  Future<void> _abrirCheckoutPromocoes() async {
    if (_carregandoCheckout) return;
    setState(() => _carregandoCheckout = true);

    try {
      final url = await _paymentService.createCheckout(
        productId: _promocoesProductId,
        quantity: 1,
      );

      final uri = Uri.parse(url);
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível abrir o checkout')),
        );
      }
    } catch (e) {
      // Mensagem tratada na tela; detalhe da exceção só no log local.
      debugPrint('Falha no checkout: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Não foi possível abrir o checkout')),
        );
      }
    } finally {
      if (mounted) setState(() => _carregandoCheckout = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final themeProvider = context.watch<ThemeProvider>();

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: ListView(
          padding: const EdgeInsets.only(bottom: AppSpacing.huge),
          children: [
            const ScreenHeader(title: 'Ajustes', eyebrow: 'SUA CONTA'),

            const SettingsGroupLabel('CONTA'),
            SettingsRow(
              icon: Icons.person_outline_rounded,
              label: 'Informações pessoais',
              onTap: () => Navigator.pushNamed(
                context,
                AppRoutes.personalInformationSettings,
              ),
            ),
            const SettingsRow(
              icon: Icons.shield_outlined,
              label: 'Segurança',
              comingSoon: true,
            ),
            SettingsRow(
              icon: Icons.manage_accounts_outlined,
              label: 'Gerenciamento de conta',
              onTap: () => Navigator.pushNamed(
                context,
                AppRoutes.accountManagementSettings,
              ),
            ),

            const SettingsGroupLabel('APARÊNCIA'),
            SettingsRow(
              icon: themeProvider.isDarkMode
                  ? Icons.dark_mode_outlined
                  : Icons.light_mode_outlined,
              label: 'Modo escuro',
              trailing: Switch(
                value: themeProvider.isDarkMode,
                activeThumbColor: colors.onAmbar,
                activeTrackColor: colors.ambar,
                inactiveTrackColor: colors.surface,
                onChanged: (_) => themeProvider.toggleTheme(),
              ),
            ),

            const SettingsGroupLabel('PRIVACIDADE'),
            const SettingsRow(
              icon: Icons.my_location_outlined,
              label: 'Permissões de localização',
              comingSoon: true,
            ),
            SettingsRow(
              icon: FontAwesomeIcons.ghost,
              label: 'Ghost vibe',
              description:
                  'Ficar invisível nos lugares em que você faz check-in',
              trailing: Switch(
                value: _modoFantasma,
                activeThumbColor: colors.onAmbar,
                activeTrackColor: colors.ambar,
                inactiveTrackColor: colors.surface,
                onChanged: (value) => setState(() => _modoFantasma = value),
              ),
            ),
            const SettingsRow(
              icon: Icons.visibility_outlined,
              label: 'Visualizar vibe checks',
              comingSoon: true,
            ),

            const SettingsGroupLabel('NOTIFICAÇÕES'),
            const SettingsRow(
              icon: Icons.people_outline_rounded,
              label: 'Amigos na área',
              comingSoon: true,
            ),
            const SettingsRow(
              icon: Icons.event_note_outlined,
              label: 'Atualizações de eventos',
              comingSoon: true,
            ),

            const SettingsGroupLabel('VIBESTER CLUB'),
            SettingsRow(
              icon: Icons.workspace_premium_outlined,
              label: 'Assinar o Vibester Club',
              description: 'Promoções e vantagens nos lugares parceiros',
              accent: true,
              loading: _carregandoCheckout,
              onTap: _abrirCheckoutPromocoes,
            ),

            const SettingsGroupLabel('AJUDA'),
            const SettingsRow(
              icon: Icons.help_outline_rounded,
              label: 'Central de ajuda',
              comingSoon: true,
            ),
            const SettingsRow(
              icon: Icons.card_giftcard_outlined,
              label: 'Convidar um amigo',
              comingSoon: true,
            ),
            const SettingsRow(
              icon: Icons.description_outlined,
              label: 'Termos e política',
              comingSoon: true,
            ),

            const SizedBox(height: AppSpacing.xxl),
            Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.screen,
              ),
              child: VibesterPressable(
                onTap: _confirmarLogout,
                borderRadius: AppRadius.pillAll,
                child: Container(
                  height: 52,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    borderRadius: AppRadius.pillAll,
                    border: Border.all(
                      color: colors.error.withValues(alpha: 0.5),
                    ),
                  ),
                  child: Text(
                    'Sair da conta',
                    style: context.typography.titleMedium.copyWith(
                      color: colors.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
