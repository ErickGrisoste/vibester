import 'package:flutter/material.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/screens/user/follow_list_screen.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Os três contadores do perfil — posts, seguidores e seguindo — em DM Mono,
/// alinhados à esquerda numa fileira só.
///
/// É o mesmo bloco no próprio perfil (VOCÊ) e no perfil dos outros; viviam
/// duplicados nas duas telas, e agora moram aqui.
///
/// Seguidores e seguindo abrem a lista de gente correspondente
/// ([FollowListScreen]); posts não abre nada porque a grade de publicações já
/// está logo abaixo, na mesma tela. Todos os números vêm da API.
class ProfileCounters extends StatelessWidget {
  /// Dono dos contadores — é a lista dele que abre ao tocar.
  final String accountId;

  /// Nome exibido no cabeçalho da listagem.
  final String? nome;

  final int postsCount;
  final int seguidores;
  final int seguindo;

  /// Desliga a navegação. Perfil bloqueado esconde as publicações; a gente
  /// dele segue a mesma regra.
  final bool enabled;

  const ProfileCounters({
    super.key,
    required this.accountId,
    required this.postsCount,
    required this.seguidores,
    required this.seguindo,
    this.nome,
    this.enabled = true,
  });

  void _abrir(BuildContext context, FollowTab tab) {
    Navigator.pushNamed(
      context,
      AppRoutes.followList,
      arguments: FollowListArgs(
        accountId: accountId,
        tab: tab,
        nome: nome,
        totalSeguidores: seguidores,
        totalSeguindo: seguindo,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final celulas = <(int, String, FollowTab?)>[
      (postsCount, 'POSTS', null),
      (seguidores, 'SEGUIDORES', FollowTab.seguidores),
      (seguindo, 'SEGUINDO', FollowTab.seguindo),
    ];

    return Row(
      children: [
        for (final (i, celula) in celulas.indexed) ...[
          if (i > 0)
            Container(
              width: 1,
              height: 28,
              margin: const EdgeInsets.symmetric(horizontal: AppSpacing.lg),
              color: colors.hairline,
            ),
          _Counter(
            value: celula.$1,
            label: celula.$2,
            onTap: celula.$3 == null || !enabled || accountId.isEmpty
                ? null
                : () => _abrir(context, celula.$3!),
          ),
        ],
      ],
    );
  }
}

class _Counter extends StatelessWidget {
  final int value;
  final String label;
  final VoidCallback? onTap;

  const _Counter({required this.value, required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;

    // A folga vertical vale para os três, mesmo sem toque: é ela que mantém
    // os números na mesma linha de base e dá alvo de toque aos que abrem.
    final conteudo = Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            value.toString(),
            style: type.monoDisplay.copyWith(
              color: colors.textPrimary,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            label,
            style: type.monoMicro.copyWith(color: colors.textDisabled),
          ),
        ],
      ),
    );

    if (onTap == null) return conteudo;

    return Semantics(
      button: true,
      label: 'Ver $label',
      child: VibesterPressable(
        onTap: onTap,
        pressScale: 0.96,
        borderRadius: AppRadius.smAll,
        child: conteudo,
      ),
    );
  }
}
