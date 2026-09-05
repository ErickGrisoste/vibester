import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/users/editing_avatar.dart';
import 'package:mobile/widgets/buttons/primary_button.dart';
import 'package:provider/provider.dart';

class ProfileEditingScreen extends StatefulWidget {
  const ProfileEditingScreen({super.key});

  @override
  State<ProfileEditingScreen> createState() => _ProfileEditingScreenState();
}

class _ProfileEditingScreenState extends State<ProfileEditingScreen> {
  final TextEditingController _nomeController = TextEditingController();
  final TextEditingController _bioController = TextEditingController();

  final _formKey = GlobalKey<FormState>();
  final _userService = UserService();
  bool _isLoading = false;

  @override
  void dispose() {
    _nomeController.dispose();
    _bioController.dispose();
    super.dispose();
  }

  Future<void> _salvarPerfil() async {
    if (!_formKey.currentState!.validate()) return;

    final userAtual = context.read<UserProvider>().user;
    final accountId = userAtual?.accountId ?? '';
    final tokenAtual = userAtual?.token;
    final nome = _nomeController.text.trim();
    final bio = _bioController.text.trim();

    setState(() => _isLoading = true);

    try {
      // UpDate Nome
      final nameResponse = await _userService.updateName(
        accountId: accountId,
        name: nome,
        username: userAtual?.nomeUsuario ?? '',
      );

      var usuarioAtualizado = UserModel.fromProfileJson(
        nameResponse,
        accountId: accountId,
        token: tokenAtual,
      );

      if (!mounted) return;
      context.read<UserProvider>().setUser(usuarioAtualizado);

      // UpDate bio
      final bioResponse = await _userService.updateBio(
        accountId: accountId,
        bio: bio,
      );

      usuarioAtualizado = UserModel.fromProfileJson(
        bioResponse,
        accountId: accountId,
        token: tokenAtual,
      );

      if (!mounted) return;
      context.read<UserProvider>().setUser(usuarioAtualizado);

      Navigator.pushNamed(context, AppRoutes.userInterests);
    } catch (e) {
      debugPrint(e.toString());

      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Não foi possível atualizar o perfil. Tente novamente.',
          ),
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
      appBar: AppBar(
        title: Text('Informações pessoais'),
        backgroundColor: context.colors.darkGrey,
        foregroundColor: context.colors.textPrimary,
        titleTextStyle: GoogleFonts.inter(fontSize: 20),
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            children: [
              Center(heightFactor: 2, child: EditableAvatar()),
              SizedBox(height: 25),

              Padding(
                padding: const EdgeInsets.only(right: 290, bottom: 10),
                child: Text(
                  'NOME',
                  style: GoogleFonts.inter(
                    color: context.colors.grey,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                  ),
                ),
              ),

              SizedBox(
                width: 350,
                height: 60,
                child: TextFormField(
                  controller: _nomeController,

                  textInputAction: TextInputAction.next,
                  style: TextStyle(color: context.colors.textPrimary),
                  cursorColor: context.colors.ambar,

                  inputFormatters: [LengthLimitingTextInputFormatter(50)],

                  decoration: InputDecoration(
                    filled: true,
                    fillColor: const Color(0xFF141414),
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
                      return 'Informe seu nome!';
                    }
                    return null;
                  },
                ),
              ),

              SizedBox(height: 30),

              Padding(
                padding: const EdgeInsets.only(right: 300, bottom: 10),
                child: Text(
                  'BIO',
                  style: GoogleFonts.inter(
                    color: context.colors.grey,
                    fontWeight: FontWeight.bold,
                    fontSize: 10,
                  ),
                ),
              ),

              SizedBox(
                width: 350,
                height: 150,
                child: TextFormField(
                  controller: _bioController,

                  maxLines: null,
                  expands: true,
                  textInputAction: TextInputAction.done,
                  style: TextStyle(color: context.colors.textPrimary),
                  cursorColor: context.colors.ambar,

                  inputFormatters: [LengthLimitingTextInputFormatter(150)],

                  decoration: InputDecoration(
                    filled: true,
                    fillColor: const Color(0xFF141414),
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
                ),
              ),

              SizedBox(height: 25),

              Padding(
                padding: const EdgeInsets.only(top: 100),
                child: PrimaryButton(
                  label: _isLoading ? 'Salvando...' : 'Cadastrar',
                  onPressed: _isLoading ? () {} : _salvarPerfil,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
