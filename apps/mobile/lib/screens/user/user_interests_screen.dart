import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/user/interest_model.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/auth_storage_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/primary_button.dart';

class UserInterestsScreen extends StatefulWidget {
  const UserInterestsScreen({super.key});

  @override
  State<UserInterestsScreen> createState() => _UserInterestsScreenState();
}

class _UserInterestsScreenState extends State<UserInterestsScreen> {
  final List<Interest> _interests = defaultInterests;
  @override
  Widget build(BuildContext context) {
    void toggle(Interest interest) {
      setState(() => interest.selected = !interest.selected);
    }

    return Scaffold(
      backgroundColor: context.colors.darkGrey,
      appBar: AppBar(
        foregroundColor: context.colors.textPrimary,
        title: Text(
          'Seus interesses',
          style: GoogleFonts.inter(color: context.colors.textPrimary),
        ),
        backgroundColor: context.colors.darkGrey,
      ),
      body: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'O que você curte?',
              style: GoogleFonts.inter(
                fontSize: 22,
                color: context.colors.ambar,
                fontWeight: FontWeight.bold,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Selecione um ou mais interesses.',
              style: GoogleFonts.inter(color: context.colors.textSecondary),
            ),
            const SizedBox(height: 24),
            Wrap(
              spacing: 10,
              runSpacing: 10,
              children: _interests.map((interest) {
                return GestureDetector(
                  onTap: () => toggle(interest),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 200),
                    padding: const EdgeInsets.symmetric(
                      horizontal: 16,
                      vertical: 10,
                    ),
                    decoration: BoxDecoration(
                      border: Border.all(color: context.colors.ambar),
                      color: interest.selected
                          ? context.colors.ambar
                          : context.colors.darkGrey,
                      borderRadius: BorderRadius.circular(30),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          interest.emoji,
                          style: const TextStyle(fontSize: 18),
                        ),
                        const SizedBox(width: 6),
                        Text(
                          interest.label,
                          style: GoogleFonts.inter(
                            color: context.colors.textPrimary,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }).toList(),
            ),
            SizedBox(height: Platform.isIOS ? 300 : 300),
            SizedBox(
              width: double.infinity,
              child: PrimaryButton(
                label: 'Continuar',
                onPressed: () async {
                  // Marca o onboarding como pendente antes de abri-lo, para
                  // que ele reapareca se o app for fechado no meio.
                  await AuthStorageService.marcarOnboardingPendente();
                  if (!mounted) return;

                  // Fim do fluxo de cadastro: remove register, email-confirm,
                  // profile-edit e esta tela da pilha. O onboarding passa a
                  // ser a unica rota; a home so vem depois do "Comecar".
                  Navigator.pushNamedAndRemoveUntil(
                    context,
                    AppRoutes.onboarding,
                    (route) => false,
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}