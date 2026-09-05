import 'dart:io';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:mobile/models/user/user_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/service/posts/post_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/location_picker.dart';
import 'package:mobile/utils/location_picker_tile.dart';
import 'package:mobile/widgets/cards/feed/post_photo_picker.dart';
import 'package:mobile/widgets/text-field/caption_text_field.dart';
import 'package:provider/provider.dart';

class NewPublicationScreen extends StatefulWidget {
  const NewPublicationScreen({super.key});

  @override
  State<NewPublicationScreen> createState() => _NewPublicationScreenState();
}

class _NewPublicationScreenState extends State<NewPublicationScreen> {
  final _formKey = GlobalKey<FormState>();
  final legendaController = TextEditingController();
  final PostService _postService = PostService();
  String? selectedLocation;
  File? _publicationImage;

  Future<void> _publicarPost(UserModel user) async {
    if (_publicationImage == null) return;

    try {
      await _postService.createPost(
        userVerified: false,
        userProfilePicture: user.fotoPerfil,
        userUsername: user.nomeUsuario,
        userId: user.userID.toString(),
        images: [_publicationImage!],
        caption: legendaController.text,
      );
      if (mounted) Navigator.pop(context);
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(e.toString())));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final UserModel? user = context.read<UserProvider>().user;
    return Scaffold(
      backgroundColor: context.colors.noturno,
      appBar: AppBar(
        actions: <Widget>[
          IconButton(
            icon: Icon(Icons.add_circle, color: context.colors.ambar, size: 30),
            onPressed: () async {
              if (!_formKey.currentState!.validate()) return;
              if (user == null) return;

              await _publicarPost(user);
            },
          ),
        ],
        title: Text(
          'Novo Post',
          style: GoogleFonts.inter(fontWeight: FontWeight.bold),
        ),
        backgroundColor: context.colors.noturno,
        foregroundColor: context.colors.textPrimary,
      ),
      body: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 15, vertical: 10),
            child: Column(
              children: [
                PostPhotoPicker(
                  onPhotoChanged: (file) {
                    setState(() => _publicationImage = file);
                  },
                ),
                const SizedBox(height: 10),

                CaptionTextField(controller: legendaController),

                const SizedBox(height: 10),

                LocationPickerTile(
                  selectedLocation: selectedLocation,
                  onTap: () async {
                    final location = await showModalBottomSheet<String>(
                      context: context,
                      backgroundColor: context.colors.noturno,
                      isScrollControlled: true,
                      builder: (_) => const LocationPicker(),
                    );

                    if (location != null) {
                      setState(() {
                        selectedLocation = location;
                      });
                    }
                  },
                ),
                SizedBox(height: 20),
                SizedBox(child: Image.asset('assets/img/mascote/dica.png')),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
