import 'package:flutter/material.dart';
import 'package:mobile/theme/theme_extensions.dart';

class AppProgressIndicator extends StatelessWidget {
  const AppProgressIndicator({super.key});

  @override
  Widget build(BuildContext context) {
    return CircularProgressIndicator(
      color: context.colors.ambar,
      backgroundColor: context.colors.noturno,
    );
  }
}
