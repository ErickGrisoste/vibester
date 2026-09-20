import 'package:flutter/material.dart';
import 'package:mobile/routes/app_routes.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/username.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/motion/vibester_pressable.dart';

/// Uma pessoa numa lista: foto redonda, nome, @ e quantos a seguem.
///
/// É a mesma linha na busca por pessoas (EXPLORAR) e nas listagens de
/// seguidores/seguindo do perfil — de propósito: quem procurou alguém e quem
/// abriu "quem me segue" está fazendo a mesma coisa, e a lista leva ao mesmo
/// lugar (o perfil da pessoa). Manter as duas num componente só evita que
/// evoluam separadas.
class UserRow extends StatelessWidget {
  final String accountId;
  final String? nome;
  final String? nomeUsuario;
  final String? fotoPerfil;

  /// Quantas pessoas seguem *esta* pessoa. Vem da API; nunca é decorativo.
  final int seguidores;

  const UserRow({
    super.key,
    required this.accountId,
    this.nome,
    this.nomeUsuario,
    this.fotoPerfil,
    this.seguidores = 0,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final handle = formatHandle(nomeUsuario);

    return VibesterPressable(
      onTap: accountId.isEmpty
          ? null
          : () => Navigator.pushNamed(
              context,
              AppRoutes.otherProfile,
              arguments: accountId,
            ),
      borderRadius: AppRadius.mdAll,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.md),
        child: Row(
          children: [
            ClipOval(
              child: SizedBox(
                width: 48,
                height: 48,
                child: VibesterImage(
                  source: fotoPerfil ?? '',
                  placeholderIcon: Icons.person_outline_rounded,
                ),
              ),
            ),
            const SizedBox(width: AppSpacing.lg),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    nome?.isNotEmpty == true
                        ? nome!
                        : (nomeUsuario?.isNotEmpty == true
                              ? nomeUsuario!
                              : 'Usuário'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.typography.titleMedium.copyWith(
                      color: colors.textPrimary,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    [
                      if (handle.isNotEmpty) handle,
                      '$seguidores SEGUINDO ELE',
                    ].join('  ·  '),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: context.typography.monoSmall.copyWith(
                      color: colors.textMuted,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.arrow_outward_rounded,
              size: 18,
              color: colors.textDisabled,
            ),
          ],
        ),
      ),
    );
  }
}
