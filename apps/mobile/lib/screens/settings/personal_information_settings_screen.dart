import 'dart:io';

import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/service/user/user_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/cards/users/editing_avatar.dart';
import 'package:provider/provider.dart';

class PersonalInformationSettingsScreen extends StatefulWidget {
  const PersonalInformationSettingsScreen({super.key});

  @override
  State<PersonalInformationSettingsScreen> createState() =>
      _PersonalInformationSettingsScreenState();
}

class _PersonalInformationSettingsScreenState
    extends State<PersonalInformationSettingsScreen> {
  final _userService = UserService();
  bool _isLoadingAvatar = false;

  void _atualizarProviderComResposta(Map<String, dynamic> response) {
    final tokenAtual = context.read<UserProvider>().user?.token;
    final accountId = context.read<UserProvider>().user?.accountId ?? '';
    final usuarioAtualizado = UserModel.fromProfileJson(
      response,
      accountId: accountId,
      token: tokenAtual,
    );
    context.read<UserProvider>().setUser(usuarioAtualizado);
  }

  void _mostrarErro(String mensagem) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(mensagem)));
  }

  Future<void> _salvarAvatar(File image) async {
    final user = context.read<UserProvider>().user;
    final accountId = user?.accountId ?? '';
    final tokenAtual = user?.token;

    if (accountId.isEmpty) return;

    setState(() => _isLoadingAvatar = true);

    try {
      final response = await _userService.updateAvatar(
        accountId: accountId,
        image: image,
      );

      if (!mounted) return;

      final usuarioAtualizado = UserModel.fromProfileJson(
        response,
        accountId: accountId,
        token: tokenAtual,
      );
      context.read<UserProvider>().setUser(usuarioAtualizado);
    } catch (e) {
      _mostrarErro('Não foi possível atualizar o avatar.');
    } finally {
      if (mounted) setState(() => _isLoadingAvatar = false);
    }
  }

  Future<void> _salvarNome(String novoNome) async {
    final user = context.read<UserProvider>().user;
    final accountId = user?.accountId ?? '';
    try {
      final response = await _userService.updateName(
        accountId: accountId,
        name: novoNome,
        username: user?.nomeUsuario ?? '',
      );
      if (!mounted) return;
      _atualizarProviderComResposta(response);
    } catch (e) {
      _mostrarErro(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _salvarUsername(String novoUsername) async {
    final user = context.read<UserProvider>().user;
    final accountId = user?.accountId ?? '';
    var usernameFormatado = novoUsername.replaceAll(' ', '');
    if (!usernameFormatado.startsWith('@')) {
      usernameFormatado = '@$usernameFormatado';
    }
    try {
      final response = await _userService.updateName(
        accountId: accountId,
        name: user?.nome ?? '',
        username: usernameFormatado,
      );
      if (!mounted) return;
      _atualizarProviderComResposta(response);
    } catch (e) {
      _mostrarErro(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  Future<void> _salvarBio(String novaBio) async {
    final user = context.read<UserProvider>().user;
    final accountId = user?.accountId ?? '';
    try {
      final response = await _userService.updateBio(
        accountId: accountId,
        bio: novaBio,
      );
      if (!mounted) return;
      _atualizarProviderComResposta(response);
    } catch (e) {
      _mostrarErro(e.toString().replaceFirst('Exception: ', ''));
    }
  }

  void _editarCampo(
    String titulo,
    String valorAtual,
    Function(String) onSalvar, {
    int? maxCaracteres,
  }) {
    final controller = TextEditingController(text: valorAtual);
    final focusNode = FocusNode();
    showDialog(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            color: context.colors.darkGrey.withAlpha(230),
            borderRadius: BorderRadius.circular(16),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: double.infinity,
                padding: const EdgeInsets.symmetric(vertical: 16),
                decoration: BoxDecoration(
                  color: context.colors.navy.withAlpha(230),
                  borderRadius: const BorderRadius.only(
                    topLeft: Radius.circular(16),
                    topRight: Radius.circular(16),
                  ),
                ),
                child: Text(
                  'Alterar $titulo',
                  style: TextStyle(
                    color: context.colors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 20,
                ),
                child: TextField(
                  controller: controller,
                  focusNode: focusNode,
                  autofocus: true,
                  maxLength: maxCaracteres,
                  style: TextStyle(color: context.colors.textPrimary),
                  cursorColor: context.colors.ambar,
                  decoration: InputDecoration(
                    enabledBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: context.colors.border),
                    ),
                    focusedBorder: UnderlineInputBorder(
                      borderSide: BorderSide(color: context.colors.ambar),
                    ),
                    counterStyle: TextStyle(color: context.colors.textDisabled),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(bottom: 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    TextButton(
                      onPressed: () {
                        focusNode.unfocus();
                        onSalvar(controller.text);
                        Navigator.pop(context);
                      },
                      // Fundo/rótulo do botão de confirmação ficam fixos
                      // (verde + branco) para manter contraste, independente
                      // do tema ativo.
                      style: TextButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: Text(
                        'Confirmar',
                        style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                      ),
                    ),
                    const SizedBox(width: 16),
                    TextButton(
                      onPressed: () {
                        focusNode.unfocus();
                        Navigator.pop(context);
                      },
                      // Rótulo fica fixo em branco para manter contraste
                      // sobre o fundo de erro (que também varia por tema).
                      style: TextButton.styleFrom(
                        backgroundColor: context.colors.error,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 24,
                          vertical: 12,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                      child: Text(
                        'Cancelar',
                        style: GoogleFonts.inter(fontWeight: FontWeight.bold),
                      ),
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

  Widget _buildRow(String label, String valor, VoidCallback onTap) {
    return GestureDetector(
      onTap: onTap,
      child: Row(
        children: [
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: GoogleFonts.inter(
                    color: context.colors.textPrimary,
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  valor,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.inter(
                    color: context.colors.textMuted,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ],
            ),
          ),
          Icon(
            Icons.edit_outlined,
            color: context.colors.textDisabled,
            size: 18,
          ),
          const SizedBox(width: 5),
        ],
      ),
    );
  }

  Widget _divider() => Container(
    margin: const EdgeInsets.only(left: 5, right: 5),
    color: context.colors.border,
    width: double.infinity,
    height: 1,
  );

  @override
  Widget build(BuildContext context) {
    final user = context.watch<UserProvider>().user;

    if (user == null) {
      return Scaffold(
        backgroundColor: context.colors.noturno,
        appBar: AppBar(
          title: const Text('Informações pessoais'),
          backgroundColor: context.colors.noturno,
          foregroundColor: context.colors.textPrimary,
        ),
        body: const Center(child: CircularProgressIndicator()),
      );
    }

    final Color cardColor = context.colors.darkGrey;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Informações pessoais',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold),
        ),
        backgroundColor: context.colors.noturno,
        foregroundColor: context.colors.textPrimary,
      ),
      backgroundColor: context.colors.noturno,
      body: SingleChildScrollView(
        child: Column(
          children: [
            const SizedBox(height: 30),

            Container(
              margin: const EdgeInsets.only(left: 16, right: 16),
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cardColor,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: context.colors.border, width: 1),
              ),
              child: Column(
                children: [
                  const SizedBox(height: 4),
                  EditableAvatar(
                    radius: 64,
                    imageUrl: user.fotoPerfil.isNotEmpty
                        ? user.fotoPerfil
                        : null,
                    onImageChanged: _salvarAvatar,
                  ),
                  if (_isLoadingAvatar)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: CircularProgressIndicator(),
                    ),
                  const SizedBox(height: 8),
                  Text(
                    user.nome,
                    style: TextStyle(
                      color: context.colors.textPrimary,
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 5),
                ],
              ),
            ),

            const SizedBox(height: 30),

            Container(
              margin: const EdgeInsets.only(left: 30),
              child: Row(
                children: [
                  Text(
                    'DADOS',
                    style: GoogleFonts.inter(
                      color: context.colors.textMuted,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 10),

            Container(
              margin: const EdgeInsets.only(left: 16, right: 16),
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cardColor,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: context.colors.border, width: 1),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildRow(
                    'Nome',
                    user.nome,
                    () => _editarCampo(
                      'Nome',
                      user.nome,
                      _salvarNome,
                      maxCaracteres: 30,
                    ),
                  ),
                  _divider(),
                  const SizedBox(height: 12),
                  _buildRow(
                    'Nome de usuário',
                    user.nomeUsuario,
                    () => _editarCampo(
                      'Nome de Usuário',
                      user.nomeUsuario,
                      _salvarUsername,
                      maxCaracteres: 30,
                    ),
                  ),
                  _divider(),
                  const SizedBox(height: 12),
                  _buildRow(
                    'Bio',
                    user.bio,
                    () => _editarCampo(
                      'Bio',
                      user.bio,
                      _salvarBio,
                      maxCaracteres: 150,
                    ),
                  ),
                  _divider(),
                  const SizedBox(height: 12),
                  _buildRow(
                    'Interesses',
                    user.interesses,
                    () => _editarCampo('Interesses', user.interesses, (valor) {
                      context.read<UserProvider>().atualizarCampo(
                        'interesses',
                        valor,
                      );
                    }),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 30),

            Container(
              margin: const EdgeInsets.only(left: 30),
              child: Row(
                children: [
                  Text(
                    'INFORMAÇÕES DA CONTA',
                    style: GoogleFonts.inter(
                      color: context.colors.textMuted,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 10),

            Container(
              margin: const EdgeInsets.only(left: 16, right: 16),
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: cardColor,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: context.colors.border, width: 1),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildRow(
                    'E-mail',
                    user.email,
                    () => _editarCampo('E-mail', user.email, (valor) {
                      context.read<UserProvider>().atualizarCampo(
                        'email',
                        valor,
                      );
                    }),
                  ),
                  _divider(),
                  _buildRow(
                    'Telefone',
                    user.telefone,
                    () => _editarCampo('Telefone', user.telefone, (valor) {
                      context.read<UserProvider>().atualizarCampo(
                        'telefone',
                        valor,
                      );
                    }),
                  ),
                  _divider(),
                  _buildRow(
                    'Data de nascimento',
                    user.dataNascimento,
                    () => _editarCampo(
                      'Data de Nascimento',
                      user.dataNascimento,
                      (valor) {
                        context.read<UserProvider>().atualizarCampo(
                          'dataNascimento',
                          valor,
                        );
                      },
                    ),
                  ),
                  _divider(),
                  _buildRow(
                    'Cidade',
                    user.cidade,
                    () => _editarCampo('Cidade', user.cidade, (valor) {
                      context.read<UserProvider>().atualizarCampo(
                        'cidade',
                        valor,
                      );
                    }),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }
}
