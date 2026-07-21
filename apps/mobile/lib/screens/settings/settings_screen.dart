import 'dart:io';

import 'package:flutter/material.dart';
import 'package:font_awesome_flutter/font_awesome_flutter.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/payment/payment_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  Color get _color => context.colors.darkGrey;
  final PaymentService _paymentService = PaymentService();
  bool modoFantasma = false;
  bool _carregandoCheckout = false;

  static const String _promocoesProductId = 'prod_g3JtzRb2TASCFuBYrQ2M4gTp';

  Future<void> _confirmarLogout() async {
    final confirmar = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.colors.darkGrey,
        title: Text(
          'Sair da conta',
          style: GoogleFonts.inter(
            color: Colors.white,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Text(
          'Tem certeza que deseja sair?',
          style: GoogleFonts.inter(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(
              'Cancelar',
              style: GoogleFonts.inter(color: Colors.white54),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(
              'Sair',
              style: GoogleFonts.inter(
                color: Colors.red,
                fontWeight: FontWeight.bold,
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
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    } finally {
      if (mounted) {
        setState(() => _carregandoCheckout = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Configurações',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold),
        ),
        backgroundColor: context.colors.noturno,
        foregroundColor: Colors.white,
      ),
      backgroundColor: context.colors.noturno,
      body: SingleChildScrollView(
        child: Column(
          children: [
            SizedBox(height: 30),

            Container(
              margin: EdgeInsets.only(left: 30),
              child: Row(
                children: [
                  Text(
                    "CONTA",
                    style: GoogleFonts.inter(
                      color: Colors.white70,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 10),

            Container(
              margin: EdgeInsets.only(left: 16, right: 16),
              width: double.infinity,
              padding: EdgeInsets.all(12),
              height: Platform.isIOS ? 190 : 150,
              decoration: BoxDecoration(
                color: _color,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white38, width: 1),
              ),

              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  //Infos
                  InkWell(
                    onTap: () {
                      Navigator.pushNamed(
                        context,
                        AppRoutes.personalInformationSettings,
                      );
                    },

                    child: Row(
                      children: [
                        Icon(Icons.person, color: Colors.white54),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "Informações Pessoais",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),

                  Container(
                    margin: EdgeInsets.only(left: 30, right: 5),
                    color: Colors.white38,
                    width: double.infinity,
                    height: 1,
                  ),

                  //Seguranca
                  InkWell(
                    onTap: () {},
                    child: Row(
                      children: [
                        Icon(Icons.security_outlined, color: Colors.white54),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "Segurança",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),

                  Container(
                    margin: EdgeInsets.only(left: 30, right: 5),
                    color: Colors.white38,
                    width: double.infinity,
                    height: 1,
                  ),

                  //Gerenciar
                  InkWell(
                    onTap: () {
                      Navigator.pushNamed(
                        context,
                        AppRoutes.accountManagementSettings,
                      );
                    },

                    child: Row(
                      children: [
                        Icon(Icons.settings_outlined, color: Colors.white54),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "Gerenciamento de Conta",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 30),

            Container(
              margin: EdgeInsets.only(left: 30),
              child: Row(
                children: [
                  Text(
                    "PRIVACIDADE",
                    style: GoogleFonts.inter(
                      color: Colors.white70,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 10),

            Container(
              margin: EdgeInsets.only(left: 16, right: 16),
              width: double.infinity,
              height: Platform.isIOS ? 230 : 150,
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _color,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white38, width: 1),
              ),

              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  //Permição
                  InkWell(
                    onTap: () {},
                    child: Row(
                      children: [
                        Icon(Icons.location_on_outlined, color: Colors.white54),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "Permissões de Localização",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 19,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),

                  Container(
                    margin: EdgeInsets.only(left: 30, right: 5),
                    color: Colors.white38,
                    width: double.infinity,
                    height: 1,
                  ),

                  //Fantasma
                  Row(
                    children: [
                      FaIcon(FontAwesomeIcons.ghost, color: Colors.white54),
                      SizedBox(width: 15),
                      Expanded(
                        child: Text(
                          "Ghost Vibe",
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 18,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),

                      Transform.scale(
                        scale: Platform.isIOS ? 1.0 : 0.8,
                        child: Switch(
                          value: modoFantasma,
                          onChanged: (value) {
                            setState(() {
                              modoFantasma = value;
                            });
                          },
                          activeColor: context.colors.brasa,
                        ),
                      ),
                    ],
                  ),

                  Container(
                    margin: EdgeInsets.only(left: 30, right: 5),
                    color: Colors.white38,
                    width: double.infinity,
                    height: 1,
                  ),

                  //Gerenciar
                  InkWell(
                    onTap: () {},
                    child: Row(
                      children: [
                        Icon(Icons.visibility_outlined, color: Colors.white60),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "Visualizar Vibe Checks",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 30),

            Container(
              margin: EdgeInsets.only(left: 30),
              child: Row(
                children: [
                  Text(
                    "NOTIFICAÇÕES",
                    style: GoogleFonts.inter(
                      color: Colors.white70,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 10),

            Container(
              margin: EdgeInsets.only(left: 16, right: 16),
              width: double.infinity,
              height: Platform.isIOS ? 190 : 150,
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _color,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white38, width: 1),
              ),

              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  //Friends in the area, fds
                  InkWell(
                    onTap: () {},
                    child: Row(
                      children: [
                        Icon(
                          Icons.notifications_outlined,
                          color: Colors.white54,
                        ),

                        SizedBox(width: 10),

                        Expanded(
                          child: Text(
                            "Amigos na Área",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),

                  Container(
                    margin: EdgeInsets.only(left: 30, right: 5),
                    color: Colors.white38,
                    width: double.infinity,
                    height: 1,
                  ),

                  //Eventos
                  InkWell(
                    onTap: () {},
                    child: Row(
                      children: [
                        Icon(
                          Icons.calendar_today_outlined,
                          color: Colors.white54,
                        ),

                        SizedBox(width: 10),

                        Expanded(
                          child: Text(
                            "Atualizações de Eventos",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),

                  Container(
                    margin: EdgeInsets.only(left: 30, right: 5),
                    color: Colors.white38,
                    width: double.infinity,
                    height: 1,
                  ),

                  //Parceria
                  InkWell(
                    onTap: _abrirCheckoutPromocoes,
                    child: Row(
                      children: [
                        _carregandoCheckout
                            ? SizedBox(
                                width: 24,
                                height: 24,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white54,
                                ),
                              )
                            : Icon(
                                Icons.confirmation_number_outlined,
                                color: Colors.white54,
                              ),

                        SizedBox(width: 10),

                        Expanded(
                          child: Text(
                            "Assinar o Vibester Club",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 30),

            Container(
              margin: EdgeInsets.only(left: 30),
              child: Row(
                children: [
                  Text(
                    "AJUDA",
                    style: GoogleFonts.inter(
                      color: Colors.white70,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 10),

            Container(
              margin: EdgeInsets.only(left: 16, right: 16),
              width: double.infinity,
              height: Platform.isIOS ? 190 : 150,
              padding: EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: _color,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.white38, width: 1),
              ),

              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  //Ajuda
                  InkWell(
                    onTap: () {},
                    child: Row(
                      children: [
                        Icon(Icons.help_outline, color: Colors.white54),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "Central de Ajuda",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),

                  Container(
                    margin: EdgeInsets.only(left: 30, right: 5),
                    color: Colors.white38,
                    width: double.infinity,
                    height: 1,
                  ),

                  //Add amigo
                  InkWell(
                    onTap: () {},
                    child: Row(
                      children: [
                        Icon(Icons.group_outlined, color: Colors.white54),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "Convidar um Amigo",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),

                  Container(
                    margin: EdgeInsets.only(left: 30, right: 5),
                    color: Colors.white38,
                    width: double.infinity,
                    height: 1,
                  ),

                  //Termos
                  InkWell(
                    onTap: () {},
                    child: Row(
                      children: [
                        Icon(Icons.description_outlined, color: Colors.white54),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "Termos e Política",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 18,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, color: Colors.white),
                      ],
                    ),
                  ),
                ],
              ),
            ),

            SizedBox(height: 30),

            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16),
              child: SizedBox(
                width: double.infinity,
                child: OutlinedButton.icon(
                  onPressed: _confirmarLogout,
                  icon: const Icon(Icons.logout, color: Colors.red),
                  label: Text(
                    'Sair da conta',
                    style: GoogleFonts.inter(
                      color: Colors.red,
                      fontWeight: FontWeight.w600,
                      fontSize: 16,
                    ),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    side: const BorderSide(color: Colors.red),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
              ),
            ),

            SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}
