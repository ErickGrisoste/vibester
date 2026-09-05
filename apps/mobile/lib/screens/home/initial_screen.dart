import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/theme_extensions.dart';

class InitialScreen extends StatefulWidget {
  const InitialScreen({super.key});

  @override
  State<InitialScreen> createState() => _InitialScreenState();
}

class _InitialScreenState extends State<InitialScreen> {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      home: Scaffold(
        backgroundColor: context.colors.navy,
        body: Container(
          margin: EdgeInsets.all(20),
          child: Column(
            children: [
              SizedBox(
                height: 250,
                child: Image.asset('assets/img/logo/logo.png'),
              ),
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    flex: 1,
                    child: Text.rich(
                      TextSpan(
                        style: GoogleFonts.inter(
                          fontSize: 32,
                          color: context.colors.textPrimary,
                          fontWeight: FontWeight.bold,
                        ),
                        children: [
                          TextSpan(text: 'Descubra os melhores '),
                          TextSpan(
                            text: 'rolês',
                            style: TextStyle(color: context.colors.ambar),
                          ),
                          TextSpan(text: ' da sua cidade'),
                        ],
                      ),
                    ),
                  ),
                  SizedBox(width: 12),
                  Image.asset(
                    'assets/img/mascote/mascote.png',
                    width: 100,
                    height: 120,
                  ),
                ],
              ),
              SizedBox(height: 16),
              Text(
                'Bares, baladas, restaurantes e eventos. Tudo em tempo real, perto de você.',
                style: GoogleFonts.inter(
                  color: context.colors.grey,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SizedBox(height: 16),
              Padding(
                padding: const EdgeInsets.all(12.0),
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: context.colors.ambar,
                    fixedSize: Size(300, 60),
                  ),
                  onPressed: () {
                    Navigator.pushNamed(context, AppRoutes.register);
                  },
                  child: Text(
                    'COMEÇAR AGORA',
                    style: GoogleFonts.inter(
                      color: context.colors.textPrimary,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: context.colors.navy,
                  fixedSize: Size(300, 60),
                  side: BorderSide(color: context.colors.ambar, width: 1),
                ),
                onPressed: () {
                  Navigator.pushNamed(context, AppRoutes.login);
                },
                child: Text(
                  'JÁ TENHO UMA CONTA',
                  style: GoogleFonts.inter(
                    color: context.colors.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              SizedBox(height: Platform.isIOS ? 80 : 100),
              Text.rich(
                textAlign: TextAlign.center,
                TextSpan(
                  style: GoogleFonts.inter(
                    color: context.colors.textPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 12,
                  ),
                  children: [
                    TextSpan(text: 'Ao continuar, voce concorda com nossos '),
                    TextSpan(
                      text: 'Termos de Uso',
                      style: TextStyle(color: context.colors.ambar),
                    ),
                    TextSpan(text: ' e'),
                    TextSpan(
                      text: ' Politica de privacidade',
                      style: TextStyle(color: context.colors.ambar),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
