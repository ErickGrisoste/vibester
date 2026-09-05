import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/theme/theme_extensions.dart';

class PostPhotoPicker extends StatefulWidget {
  final ValueChanged<File?>? onPhotoChanged;

  const PostPhotoPicker({super.key, this.onPhotoChanged});

  @override
  State<PostPhotoPicker> createState() => _PostPhotoPickerState();
}

class _PostPhotoPickerState extends State<PostPhotoPicker> {
  File? _photo;

  Future<void> _pick(ImageSource source) async {
    final picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 85,
    );
    if (picked == null) return;
    final file = File(picked.path);
    setState(() => _photo = file);
    widget.onPhotoChanged?.call(file);
  }

  void _showOptions() {
    showModalBottomSheet(
      context: context,
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Galeria'),
            onTap: () {
              Navigator.pop(context);
              _pick(ImageSource.gallery);
            },
          ),
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Câmera'),
            onTap: () {
              Navigator.pop(context);
              _pick(ImageSource.camera);
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _showOptions,
      child: AspectRatio(
        aspectRatio: 4 / 5,
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: context.colors.darkGrey.withAlpha(40),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: context.colors.border, width: 1.5),
          ),
          child: _photo == null
              ? Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      Icons.add_photo_alternate_outlined,
                      size: 48,
                      color: context.colors.ambar.withAlpha(180),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Adicionar foto',
                      style: TextStyle(
                        color: context.colors.ambar.withAlpha(180),
                        fontSize: 14,
                      ),
                    ),
                  ],
                )
              : ClipRRect(
                  borderRadius: BorderRadius.circular(11),
                  child: Image.file(_photo!, fit: BoxFit.cover),
                ),
        ),
      ),
    );
  }
}
