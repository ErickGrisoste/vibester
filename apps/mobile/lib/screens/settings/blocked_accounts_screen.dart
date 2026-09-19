import 'package:flutter/material.dart';
import 'package:mobile/models/safety/blocked_profile.dart';
import 'package:mobile/service/safety/safety_service.dart';
import 'package:mobile/theme/app_spacing.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:mobile/utils/username.dart';
import 'package:mobile/widgets/buttons/vibester_button.dart';
import 'package:mobile/widgets/common/screen_header.dart';
import 'package:mobile/widgets/common/vibester_image.dart';
import 'package:mobile/widgets/common/vibester_skeleton.dart';
import 'package:mobile/widgets/common/vibester_state.dart';
import 'package:mobile/widgets/safety/safety_actions.dart';

/// Ajustes > Contas bloqueadas: o caminho de volta de um bloqueio.
class BlockedAccountsScreen extends StatefulWidget {
  final SafetyService? service;

  const BlockedAccountsScreen({super.key, this.service});

  @override
  State<BlockedAccountsScreen> createState() => _BlockedAccountsScreenState();
}

class _BlockedAccountsScreenState extends State<BlockedAccountsScreen> {
  late final SafetyService _service = widget.service ?? SafetyService();

  final List<BlockedProfile> _perfis = [];
  final Set<String> _desbloqueando = {};
  String? _nextCursor;
  bool _carregando = true;
  bool _carregandoMais = false;
  String? _erro;

  @override
  void initState() {
    super.initState();
    _carregar();
  }

  Future<void> _carregar() async {
    setState(() {
      _carregando = true;
      _erro = null;
    });
    try {
      final page = await _service.listBlocked();
      if (!mounted) return;
      setState(() {
        _perfis
          ..clear()
          ..addAll(page.perfis);
        _nextCursor = page.nextCursor;
        _carregando = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _carregando = false;
        _erro = e.toString().replaceFirst('Exception: ', '');
      });
    }
  }

  Future<void> _carregarMais() async {
    final cursor = _nextCursor;
    if (cursor == null || _carregandoMais) return;
    setState(() => _carregandoMais = true);
    try {
      final page = await _service.listBlocked(cursor: cursor);
      if (!mounted) return;
      setState(() {
        _perfis.addAll(page.perfis);
        _nextCursor = page.nextCursor;
      });
    } catch (e) {
      debugPrint('Falha ao carregar mais bloqueados: $e');
    } finally {
      if (mounted) setState(() => _carregandoMais = false);
    }
  }

  Future<void> _desbloquear(BlockedProfile perfil) async {
    setState(() => _desbloqueando.add(perfil.accountId));
    final ok = await unblockUser(context, accountId: perfil.accountId);
    if (!mounted) return;
    setState(() {
      _desbloqueando.remove(perfil.accountId);
      if (ok) _perfis.removeWhere((p) => p.accountId == perfil.accountId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.noturno,
      body: SafeArea(
        bottom: false,
        child: RefreshIndicator(
          color: colors.ambar,
          backgroundColor: colors.surface,
          onRefresh: _carregar,
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              const SliverToBoxAdapter(
                child: ScreenHeader(
                  title: 'Contas\nbloqueadas',
                  eyebrow: 'PRIVACIDADE',
                ),
              ),
              if (_carregando)
                const SliverPadding(
                  padding: EdgeInsets.all(AppSpacing.screen),
                  sliver: SliverToBoxAdapter(
                    child: VibesterSkeletonLines(lines: 4, spacing: AppSpacing.lg),
                  ),
                )
              else if (_erro != null)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: VibesterState.error(message: _erro!, onAction: _carregar),
                )
              else if (_perfis.isEmpty)
                const SliverFillRemaining(
                  hasScrollBody: false,
                  child: VibesterState(
                    headline: 'Ninguém bloqueado',
                    message:
                        'Quando você bloquear um perfil, ele aparece aqui e '
                        'dá pra desfazer quando quiser.',
                    icon: Icons.block_rounded,
                  ),
                )
              else ...[
                SliverList.builder(
                  itemCount: _perfis.length,
                  itemBuilder: (context, i) => _BlockedRow(
                    perfil: _perfis[i],
                    loading: _desbloqueando.contains(_perfis[i].accountId),
                    onUnblock: () => _desbloquear(_perfis[i]),
                  ),
                ),
                if (_nextCursor != null)
                  SliverPadding(
                    padding: const EdgeInsets.all(AppSpacing.screen),
                    sliver: SliverToBoxAdapter(
                      child: VibesterButton(
                        label: 'Carregar mais',
                        variant: VibesterButtonVariant.ghost,
                        state: _carregandoMais
                            ? VibesterButtonState.loading
                            : VibesterButtonState.idle,
                        onPressed: _carregarMais,
                      ),
                    ),
                  ),
              ],
              const SliverPadding(
                padding: EdgeInsets.only(bottom: AppSpacing.huge),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BlockedRow extends StatelessWidget {
  final BlockedProfile perfil;
  final bool loading;
  final VoidCallback onUnblock;

  const _BlockedRow({
    required this.perfil,
    required this.loading,
    required this.onUnblock,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final type = context.typography;
    final handle = formatHandle(perfil.nomeUsuario);

    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.screen,
        vertical: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.hairline)),
      ),
      child: Row(
        children: [
          ClipOval(
            child: SizedBox(
              width: 44,
              height: 44,
              child: VibesterImage(
                source: perfil.fotoPerfil,
                placeholderIcon: Icons.person_outline_rounded,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  perfil.nome.isEmpty ? 'Perfil sem nome' : perfil.nome,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: type.titleSmall.copyWith(color: colors.textPrimary),
                ),
                if (handle.isNotEmpty)
                  Text(
                    handle,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: type.monoSmall.copyWith(color: colors.textMuted),
                  ),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          VibesterButton(
            label: 'Desbloquear',
            variant: VibesterButtonVariant.outline,
            compact: true,
            expand: false,
            state: loading ? VibesterButtonState.loading : VibesterButtonState.idle,
            onPressed: onUnblock,
          ),
        ],
      ),
    );
  }
}
