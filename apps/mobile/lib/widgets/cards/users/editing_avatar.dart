import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:mobile/theme/theme_extensions.dart';

class EditableAvatar extends StatefulWidget {
  final String? imageUrl;
  final Future<void> Function(File)? onImageChanged;
  final double radius;

  const EditableAvatar({
    super.key,
    this.imageUrl,
    this.onImageChanged,
    this.radius = 0,
  });

  @override
  State<EditableAvatar> createState() => _EditableAvatarState();
}

class _EditableAvatarState extends State<EditableAvatar> {
  File? _image;

  @override
  void initState() {
    super.initState();
    debugPrint(
      '>>> EditableAvatar onImageChanged é null? ${widget.onImageChanged == null}',
    );
  }

  Future<void> _pick(ImageSource source) async {
    final picked = await ImagePicker().pickImage(
      source: source,
      imageQuality: 85,
    );
    if (picked == null) return;
    if (!mounted) return;
    final file = File(picked.path);
    setState(() => _image = file);
    debugPrint('>>> chamando onImageChanged');
    await widget.onImageChanged?.call(file);
  }

  void _showOptions() {
    showModalBottomSheet(
      context: context,
      builder: (_) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          ListTile(
            leading: const Icon(Icons.photo_camera_outlined),
            title: const Text('Câmera'),
            onTap: () {
              Navigator.pop(context);
              _pick(ImageSource.camera);
            },
          ),
          ListTile(
            leading: const Icon(Icons.photo_library_outlined),
            title: const Text('Galeria'),
            onTap: () {
              Navigator.pop(context);
              _pick(ImageSource.gallery);
            },
          ),
        ],
      ),
    );
  }

  ImageProvider? get _provider {
    if (_image != null) return FileImage(_image!);
    if (widget.imageUrl != null) {
      return CachedNetworkImageProvider(widget.imageUrl!);
    }
    return null;
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _showOptions,
      child: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: context.colors.ambar.withAlpha(150),
                width: 2,
              ),
            ),
            child: CircleAvatar(
              backgroundColor: context.colors.darkGrey.withAlpha(150),
              radius: widget.radius > 0 ? widget.radius : 48,
              backgroundImage: _provider,
              child: _provider == null
                  ? Icon(
                      Icons.camera_alt,
                      color: context.colors.textPrimary,
                      size: 50,
                    )
                  : null,
            ),
          ),
          Positioned(
            bottom: 0,
            right: 0,
            child: CircleAvatar(
              radius: 48 * 0.28,
              backgroundColor: context.colors.ambar,
              child: Icon(Icons.edit, size: 48 * 0.28, color: Colors.white),
            ),
          ),
        ],
      ),
    );
  }
}
