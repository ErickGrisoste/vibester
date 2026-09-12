import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/screens/register/email_confirm_screen.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/buttons/primary_button.dart';

class RecoverPasswordScreen extends StatefulWidget {
  const RecoverPasswordScreen({super.key});

  @override
  State<RecoverPasswordScreen> createState() => _RecoverPasswordScreenState();
}

class _RecoverPasswordScreenState extends State<RecoverPasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.darkGrey,
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 100),
            child: Column(
              children: [
                Center(
                  child: SizedBox(
                    width: 130,
                    height: 265,
                    child: Image.asset('assets/img/mascote/mascote.png'),
                  ),
                ),

                Text(
                  'Recuperar Vibe',
                  style: GoogleFonts.inter(
                    color: context.colors.textPrimary,
                    fontSize: 32,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  'Insira seu email para recuperação de conta',
                  style: GoogleFonts.inter(color: context.colors.grey),
                ),

                SizedBox(height: 15),

                Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(right: 280, bottom: 10),
                      child: Text(
                        'E-MAIL',
                        style: GoogleFonts.inter(
                          color: context.colors.grey,
                          fontWeight: FontWeight.bold,
                          fontSize: 10,
                        ),
                      ),
                    ),
                    SizedBox(
                      width: 350,
                      child: TextFormField(
                        controller: _emailController,
                        style: TextStyle(color: context.colors.textPrimary),
                        cursorColor: context.colors.ambar,
                        decoration: InputDecoration(
                          filled: true,
                          fillColor: context.colors.darkGrey,
                          prefixIcon: Icon(Icons.email_outlined),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                          errorStyle: TextStyle(
                            color: context.colors.error,
                            fontSize: 12,
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide(
                              color: context.colors.border,
                              width: 1.3,
                            ),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide(
                              color: context.colors.ambar,
                              width: 1.3,
                            ),
                          ),
                          errorBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide(
                              color: context.colors.error,
                              width: 1.3,
                            ),
                          ),
                          focusedErrorBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(18),
                            borderSide: BorderSide(
                              color: context.colors.error,
                              width: 1.3,
                            ),
                          ),
                        ),
                        keyboardType: TextInputType.emailAddress,
                        validator: (value) {
                          if (value == null || value.isEmpty) {
                            return 'Campo obrigatório!';
                          }
                          return null;
                        },
                      ),
                    ),
                  ],
                ),

                Column(
                  children: [
                    Padding(
                      padding: const EdgeInsets.only(top: 50),
                      child: SizedBox(
                        width: 350,
                        height: 50,
                        child: PrimaryButton(
                          label: 'Enviar Codigo',
                          onPressed: () {
                            if (!_formKey.currentState!.validate()) return;

                            final email = _emailController.text.trim();

                            Navigator.push(
                              context,
                              MaterialPageRoute(
                                builder: (context) => EmailConfirmScreen(
                                  senha: '',
                                  email: email,
                                  onEmailConfirmed: () {
                                    Navigator.pushNamed(
                                      context,
                                      AppRoutes.resetPassword,
                                      arguments: email,
                                    );
                                  },
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
