import 'package:flutter/material.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/theme/app_motion.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/motion/like_heart.dart';
import 'package:provider/provider.dart';

/// Curtida do post no feed: o coração animado (`LikeHeart`) e o contador
/// animando entre os valores.
class LikeIndicator extends StatelessWidget {
  final PublicationModel publication;
  const LikeIndicator({super.key, required this.publication});

  void _toggleLike(BuildContext context) {
    final userId = context.read<UserProvider>().user?.accountId;
    if (userId == null) return;
    context.read<PublicationListProvider>().toggleLike(publication.id, userId);
  }

  @override
  Widget build(BuildContext context) {
    final color = publication.isLiked
        ? context.colors.brasa
        : context.colors.textDisabled;

    return Semantics(
      button: true,
      label: publication.isLiked ? 'Descurtir' : 'Curtir',
      child: GestureDetector(
        onTap: () => _toggleLike(context),
        behavior: HitTestBehavior.opaque,
        child: Padding(
          // Alvo de toque confortável sem caixa visível em volta: a ação é o
          // ícone, não um botão desenhado.
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              LikeHeart(
                // Com a chave, um card reaproveitado para outro post não
                // "celebra" a troca de dados como se fosse uma curtida.
                key: ValueKey(publication.id),
                liked: publication.isLiked,
                inactiveColor: context.colors.textDisabled,
              ),
              const SizedBox(width: 8),
              TweenAnimationBuilder<int>(
                tween: IntTween(begin: 0, end: publication.likes),
                duration: context.adaptiveMotion(AppMotion.ui),
                curve: AppMotion.standard,
                builder: (context, value, _) => Text(
                  value.toString().padLeft(2, '0'),
                  style: context.typography.mono.copyWith(color: color),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
