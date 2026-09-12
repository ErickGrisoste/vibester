import 'dart:io';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/graffiti/grain.dart';

/// Imagem do Vibester — o único lugar do app que decide como uma foto
/// carrega, falha e aparece.
///
/// Existe porque o padrão anterior (`CachedNetworkImage` solto, com
/// `CircularProgressIndicator` no placeholder e `Icon(Icons.error)` no erro)
/// aparecia em nove arquivos diferentes: cada card tratava falha de rede de
/// um jeito, e um ícone de erro cru no meio de um card de evento é a coisa
/// menos premium possível.
///
/// Aqui: esqueleto enquanto carrega, superfície com grão e marca discreta
/// quando não há foto ou a foto falha, fade curto ao aparecer.
class VibesterImage extends StatelessWidget {
  /// URL remota, caminho de arquivo local (`/...`, para preview de upload) ou
  /// asset (`assets/...`). String vazia cai direto no placeholder.
  final String source;

  final BoxFit fit;
  final double? width;
  final double? height;

  /// Ícone da marca d'água exibida quando não há imagem.
  final IconData placeholderIcon;

  /// Alinhamento do recorte. `Alignment.topCenter` costuma ser melhor que o
  /// centro para cartaz de evento (o título fica no topo da arte).
  final Alignment alignment;

  const VibesterImage({
    super.key,
    required this.source,
    this.fit = BoxFit.cover,
    this.width,
    this.height,
    this.placeholderIcon = Icons.image_outlined,
    this.alignment = Alignment.center,
  });

  @override
  Widget build(BuildContext context) {
    Widget image;

    if (source.isEmpty) {
      image = _Placeholder(icon: placeholderIcon);
    } else if (source.startsWith('assets/')) {
      image = Image.asset(
        source,
        fit: fit,
        width: width,
        height: height,
        alignment: alignment,
        errorBuilder: (_, _, _) => _Placeholder(icon: placeholderIcon),
      );
    } else if (!source.startsWith('http')) {
      image = Image.file(
        File(source),
        fit: fit,
        width: width,
        height: height,
        alignment: alignment,
        errorBuilder: (_, _, _) => _Placeholder(icon: placeholderIcon),
      );
    } else {
      image = CachedNetworkImage(
        imageUrl: source,
        fit: fit,
        width: width,
        height: height,
        alignment: alignment,
        fadeInDuration: AppMotion.imageFade,
        fadeOutDuration: AppMotion.imageFade,
        placeholder: (_, _) => const VibesterSkeleton(),
        errorWidget: (_, _, _) => _Placeholder(icon: placeholderIcon),
      );
    }

    return SizedBox(width: width, height: height, child: image);
  }
}

/// Superfície de "sem foto": não é um ícone de erro cru, é um pedaço de
/// parede — cor da paleta, grão e uma marca fraca no centro.
class _Placeholder extends StatelessWidget {
  final IconData icon;

  const _Placeholder({required this.icon});

  @override
  Widget build(BuildContext context) {
    return ColoredBox(
      color: context.colors.surface,
      child: Grain(
        opacity: 0.07,
        density: 0.8,
        child: Center(
          child: Icon(
            icon,
            size: 26,
            color: context.colors.textDisabled.withValues(alpha: 0.5),
          ),
        ),
      ),
    );
  }
}
