import 'package:flutter/material.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/common/vibester_tag.dart';
import 'package:mobile/widgets/graffiti/grain.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';
import 'package:url_launcher/url_launcher.dart';

/// Bloco de localização com atalho para o app de mapas.
///
/// A base continua sendo a arte estática (`assets/img/map_fundo.png`) — não há
/// mapa interativo aqui, e fingir que há seria pior do que assumir. O bloco
/// agora se apresenta como o que é: uma superfície tratada, com o endereço em
/// cima e uma ação clara, em vez de um botão branco genérico centralizado
/// sobre a imagem.
class MapEvent extends StatelessWidget {
  final String endereco;

  const MapEvent({super.key, required this.endereco});

  Future<void> _abrirMaps(BuildContext context) async {
    final uri = Uri.parse(
      'https://www.google.com/maps/search/?api=1&query='
      '${Uri.encodeComponent(endereco)}',
    );

    final aberto = await launchUrl(uri, mode: LaunchMode.externalApplication);
    if (!aberto && context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Não foi possível abrir o mapa')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Semantics(
      button: true,
      label: 'Abrir no mapa',
      child: VibesterPressable(
        onTap: () => _abrirMaps(context),
        borderRadius: AppRadius.mdAll,
        child: ClipRRect(
          borderRadius: AppRadius.mdAll,
          child: SizedBox(
            height: 150,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  'assets/img/map_fundo.png',
                  fit: BoxFit.cover,
                  errorBuilder: (_, _, _) => ColoredBox(color: colors.surface),
                ),
                const Grain(opacity: 0.08, density: 0.6),
                DecoratedBox(
                  decoration: BoxDecoration(gradient: colors.photoScrim),
                ),
                Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: Align(
                    alignment: Alignment.bottomLeft,
                    child: VibesterTag(
                      'ABRIR NO MAPS',
                      icon: Icons.near_me_outlined,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
