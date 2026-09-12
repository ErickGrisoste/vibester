import 'package:email_validator/email_validator.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/date_picker_field.dart';
import 'package:mobile/widgets/buttons/primary_button.dart';

class RegisterScreen extends StatefulWidget {
  const RegisterScreen({super.key});

  @override
  State<RegisterScreen> createState() => _RegisterScreenState();
}

class _RegisterScreenState extends State<RegisterScreen> {
  final TextEditingController _nomeController = TextEditingController();
  final TextEditingController _emailController = TextEditingController();
  final TextEditingController _senhaController = TextEditingController();
  DateTime? _dataNascimento;

  final _formKey = GlobalKey<FormState>();
  final _userService = UserService();
  bool _isLoading = false;

  @override
  void dispose() {
    _nomeController.dispose();
    _emailController.dispose();
    _senhaController.dispose();
    super.dispose();
  }

  String? _erroApi;

  String _formatarBornAt(DateTime data) {
    final ano = data.year.toString().padLeft(4, '0');
    final mes = data.month.toString().padLeft(2, '0');
    final dia = data.day.toString().padLeft(2, '0');
    return '$ano-$mes-$dia';
  }

  Future<void> _criarConta() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final nomeDigitado = _nomeController.text.trim();
    final usernameFormatado = '@${nomeDigitado.replaceAll(' ', '')}';
    final email = _emailController.text.trim();
    final senha = _senhaController.text;
    final bornAtFormatado = _formatarBornAt(_dataNascimento!);

    try {
      await _userService.register(
        name: nomeDigitado,
        username: usernameFormatado,
        email: email,
        password: senha,
        bornAt: bornAtFormatado,
      );

      if (!mounted) return;
      if (!mounted) return;
      Navigator.pushNamed(
        context,
        AppRoutes.emailConfirm,
        arguments: {'email': email, 'senha': senha},
      );
    } catch (e) {
      _erroApi = e.toString();
      debugPrint(_erroApi);

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Não foi possível criar a conta. Tente novamente.'),
        ),
      );
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: context.colors.darkGrey,
      body: Stack(
        children: [
          Form(
            key: _formKey,
            child: SingleChildScrollView(
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
                    'Criar conta',
                    style: GoogleFonts.inter(
                      color: context.colors.textPrimary,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                    ),
                  ),

                  Text(
                    'Preencha seus dados para começar',
                    style: GoogleFonts.inter(color: context.colors.grey),
                  ),

                  const SizedBox(height: 15),

                  Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 280, bottom: 10),
                        child: Text(
                          'USUÁRIO',
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
                          controller: _nomeController,

                          textInputAction: TextInputAction.next,
                          style: TextStyle(color: context.colors.textPrimary),
                          cursorColor: context.colors.ambar,

                          inputFormatters: [
                            LengthLimitingTextInputFormatter(50),
                            FilteringTextInputFormatter.deny(RegExp('@')),
                          ],

                          decoration: InputDecoration(
                            filled: true,
                            fillColor: context.colors.darkGrey,
                            prefixIcon: const Icon(Icons.person),
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

                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Informe seu nome de usuário!';
                            }
                            if (value.contains('@')) {
                              return 'O nome de usuario não pode conter "@"!';
                            }

                            return null;
                          },
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 10),

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

                          textInputAction: TextInputAction.next,
                          style: TextStyle(color: context.colors.textPrimary),
                          cursorColor: context.colors.ambar,

                          inputFormatters: [
                            LengthLimitingTextInputFormatter(320),
                          ],

                          decoration: InputDecoration(
                            filled: true,
                            fillColor: context.colors.darkGrey,
                            prefixIcon: const Icon(Icons.email_outlined),
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

                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Informe seu email!';
                            }
                            if (!EmailValidator.validate(value)) {
                              return 'Informe um email válido!';
                            }
                            return null;
                          },
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 12),
                  Padding(
                    padding: const EdgeInsets.only(right: 211, bottom: 10),
                    child: Column(
                      children: [
                        Text(
                          'DATA DE NASCIMENTO',
                          style: GoogleFonts.inter(
                            color: context.colors.grey,
                            fontWeight: FontWeight.bold,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                  DatePickerField(
                    labelText: 'Data de Nascimento',
                    height: 60,

                    onDateSelected: (data) {
                      _dataNascimento = data;
                    },

                    validator: (value) {
                      if (value == null) {
                        return 'Informe sua data de nascimento!';
                      }
                      return null;
                    },
                  ),

                  const SizedBox(height: 12),

                  Column(
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(right: 290, bottom: 10),
                        child: Text(
                          'SENHA',
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
                          controller: _senhaController,

                          obscureText: true,
                          textInputAction: TextInputAction.done,
                          style: TextStyle(color: context.colors.textPrimary),
                          cursorColor: context.colors.ambar,

                          inputFormatters: [
                            LengthLimitingTextInputFormatter(20),
                          ],

                          decoration: InputDecoration(
                            filled: true,
                            fillColor: context.colors.darkGrey,
                            prefixIcon: const Icon(Icons.lock_outline),
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

                          validator: (value) {
                            if (value == null || value.isEmpty) {
                              return 'Informe uma senha!';
                            }
                            if (value.length < 8) {
                              return 'A senha deve ter pelo menos 8 caracteres!';
                            }
                            return null;
                          },
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 50),

                  SizedBox(
                    width: 350,
                    height: 50,
                    child: PrimaryButton(
                      label: _isLoading ? 'Criando conta...' : 'Entrar',
                      onPressed: _isLoading ? () {} : _criarConta,
                    ),
                  ),
                ],
              ),
            ),
          ),

          //Botão de voltar
          Positioned(
            top: 20,
            left: 16,
            child: SafeArea(
              child: CircleAvatar(
                backgroundColor: context.colors.darkGrey.withOpacity(0.8),
                child: IconButton(
                  onPressed: () => Navigator.pop(context),
                  icon: Icon(
                    Icons.arrow_back_ios_new,
                    color: context.colors.ambar,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
