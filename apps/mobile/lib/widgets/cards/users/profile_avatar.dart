import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class ProfileAvatar extends StatelessWidget {
  final String? imageUrl;
  final VoidCallback? onTap;
  final bool editable;

  const ProfileAvatar({
    super.key,
    this.imageUrl,
    this.onTap,
    this.editable = true,
  });

  ImageProvider? get _imageProvider {
    if (imageUrl == null) return null;

    if (imageUrl!.startsWith('http')) {
      return CachedNetworkImageProvider(imageUrl!);
    }

    return FileImage(File(imageUrl!));
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: editable ? onTap : null,
      child: Stack(
        children: [
          Container(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              border: Border.all(
                color: Colors.amberAccent.withAlpha(150),
                width: 3,
              ),
              boxShadow: [
                BoxShadow(
                  color: Colors.amberAccent.withAlpha(80),
                  blurRadius: 8,
                  spreadRadius: 2,
                ),
                BoxShadow(
                  color: Colors.amberAccent.withAlpha(40),
                  blurRadius: 20,
                  spreadRadius: 6,
                ),
              ],
            ),
            child: CircleAvatar(
              backgroundColor: context.colors.darkGrey.withAlpha(150),
              radius: 48,
              backgroundImage: _imageProvider,
              child: _imageProvider == null
                  ? Icon(
                      Icons.camera_alt,
                      color: context.colors.textPrimary,
                      size: 50,
                    )
                  : null,
            ),
          ),
          if (editable)
            Positioned(
              bottom: 0,
              right: 0,
              child: Container(
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: Colors.amberAccent.withAlpha(80),
                      blurRadius: 8,
                      spreadRadius: 2,
                    ),
                    BoxShadow(
                      color: Colors.amberAccent.withAlpha(40),
                      blurRadius: 20,
                      spreadRadius: 6,
                    ),
                  ],
                ),
                child: CircleAvatar(
                  radius: 48 * 0.28,
                  backgroundColor: Colors.black,
                  child: Icon(
                    Icons.add_circle_outlined,
                    size: 48 * 0.50,
                    color: Colors.white,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
