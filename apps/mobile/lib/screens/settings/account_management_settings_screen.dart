import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/theme/theme_extensions.dart';

class AccountManagementSettingsScreen extends StatefulWidget {
  const AccountManagementSettingsScreen({super.key});

  @override
  State<AccountManagementSettingsScreen> createState() =>
      _AccountManagementSettingsScreenState();
}

class _AccountManagementSettingsScreenState
    extends State<AccountManagementSettingsScreen> {
  Color get _color => context.colors.darkGrey;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Gerenciar Conta',
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
                    "DADOS E ATIVIDADE",
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
              height: Platform.isIOS ? 180 : 105,
              padding: EdgeInsets.all(12),
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
                    onTap: () {},
                    child: Row(
                      children: [
                        Icon(Icons.person, color: Colors.white54),
                        SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            "Historico de Vibe Checks",
                            style: GoogleFonts.inter(
                              color: Colors.white,
                              fontSize: 19.5,
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
                            "Vincular e Gerenciar Contas",
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
          ],
        ),
      ),
    );
  }
}
