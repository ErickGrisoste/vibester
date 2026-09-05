import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:mobile/models/highlights/highlight_model.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/service/posts/post_service.dart';
import 'package:mobile/theme/theme_extensions.dart';
import 'package:provider/provider.dart';

class PostDetailScreen extends StatefulWidget {
  final HighlightModel highlight;

  const PostDetailScreen({super.key, required this.highlight});

  @override
  State<PostDetailScreen> createState() => _PostDetailScreenState();
}

class _PostDetailScreenState extends State<PostDetailScreen> {
  final PostService _postService = PostService();
  late final PageController _pageController;
  late HighlightModel _highlight;
  int _paginaAtual = 0;
  bool _isTogglingLike = false;

  @override
  void initState() {
    super.initState();
    _highlight = widget.highlight;
    _pageController = PageController();
  }

  Future<void> _alternarCurtida() async {
    final userId = context.read<UserProvider>().user?.accountId;
    if (userId == null || _isTogglingLike) return;

    final curtiaAntes = _highlight.curtidoPeloUsuario;
    setState(() {
      _isTogglingLike = true;
      _highlight = _highlight.copyWith(
        curtidoPeloUsuario: !curtiaAntes,
        totalCurtidas: curtiaAntes
            ? _highlight.totalCurtidas - 1
            : _highlight.totalCurtidas + 1,
      );
    });

    try {
      if (curtiaAntes) {
        await _postService.unlikePost(
          postId: _highlight.postId,
          userId: userId,
        );
      } else {
        await _postService.likePost(postId: _highlight.postId, userId: userId);
      }
    } catch (e) {
      final is409 =
          e.toString().contains('409') ||
          e.toString().contains('already liked') ||
          e.toString().contains('already unliked');
      // 409 significa que o backend já está no estado pra onde tentamos ir
      // (ex: curtida duplicada por uma corrida com outra tela) — mantém a UI.
      if (!is409 && mounted) {
        setState(() {
          _highlight = _highlight.copyWith(
            curtidoPeloUsuario: curtiaAntes,
            totalCurtidas: _highlight.totalCurtidas + (curtiaAntes ? 1 : -1),
          );
        });
      }
    } finally {
      if (mounted) setState(() => _isTogglingLike = false);
    }
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  String _formatarData(String isoDate) {
    if (isoDate.isEmpty) return '';
    try {
      final data = DateTime.parse(isoDate);
      return DateFormat("d 'de' MMMM 'de' y", 'pt_BR').format(data);
    } catch (_) {
      return '';
    }
  }

  @override
  Widget build(BuildContext context) {
    final highlight = _highlight;
    final imagens = highlight.imagensUrls;
    final dataFormatada = _formatarData(highlight.criadoEm);

    // Limita a resolução decodificada ao tamanho real da tela (em pixels
    // físicos). Sem isso, uma foto de câmera em resolução original consome
    // memória suficiente para expulsar outras imagens do cache global,
    // fazendo-as "recarregar" visualmente ao voltar para outras telas.
    final imagemCacheWidth =
        (MediaQuery.of(context).size.width *
                MediaQuery.of(context).devicePixelRatio)
            .round();

    return Scaffold(
      backgroundColor: context.colors.noturno,
      appBar: AppBar(
        backgroundColor: context.colors.noturno,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: context.colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          'Publicação',
          style: GoogleFonts.inter(
            color: context.colors.textPrimary,
            fontWeight: FontWeight.bold,
          ),
        ),
        centerTitle: true,
      ),
      body: ListView(
        children: [
          // Carrossel de imagens (caso tenha mais de uma)
          AspectRatio(
            aspectRatio: 1,
            child: imagens.isEmpty
                ? Container(
                    color: Colors.white12,
                    child: Center(
                      child: Icon(
                        Icons.image_not_supported_outlined,
                        color: context.colors.textDisabled,
                        size: 48,
                      ),
                    ),
                  )
                : Stack(
                    alignment: Alignment.bottomCenter,
                    children: [
                      PageView.builder(
                        controller: _pageController,
                        itemCount: imagens.length,
                        onPageChanged: (index) =>
                            setState(() => _paginaAtual = index),
                        itemBuilder: (context, index) {
                          return CachedNetworkImage(
                            imageUrl: imagens[index],
                            fit: BoxFit.cover,
                            memCacheWidth: imagemCacheWidth,
                            fadeInDuration: Duration.zero,
                            fadeOutDuration: Duration.zero,
                            errorWidget: (context, url, error) {
                              return Container(
                                color: Colors.white12,
                                child: Icon(
                                  Icons.broken_image_outlined,
                                  color: context.colors.textDisabled,
                                ),
                              );
                            },
                          );
                        },
                      ),

                      if (imagens.length > 1)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: List.generate(imagens.length, (index) {
                              return Container(
                                margin: const EdgeInsets.symmetric(
                                  horizontal: 3,
                                ),
                                width: 7,
                                height: 7,
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: index == _paginaAtual
                                      ? context.colors.ambar
                                      : Colors.white38,
                                ),
                              );
                            }),
                          ),
                        ),
                    ],
                  ),
          ),

          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Curtidas e comentários
                Row(
                  children: [
                    GestureDetector(
                      onTap: _alternarCurtida,
                      behavior: HitTestBehavior.opaque,
                      child: Icon(
                        highlight.curtidoPeloUsuario
                            ? Icons.favorite
                            : Icons.favorite_outline,
                        color: highlight.curtidoPeloUsuario
                            ? context.colors.brasa
                            : context.colors.textSecondary,
                        size: 22,
                      ),
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${highlight.totalCurtidas}',
                      style: TextStyle(
                        color: context.colors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(width: 20),
                    Icon(
                      Icons.mode_comment_outlined,
                      color: context.colors.textSecondary,
                      size: 20,
                    ),
                    const SizedBox(width: 6),
                    Text(
                      '${highlight.totalComentarios}',
                      style: TextStyle(
                        color: context.colors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ],
                ),

                const SizedBox(height: 16),

                // Legenda
                if (highlight.legenda.isNotEmpty)
                  Text(
                    highlight.legenda,
                    style: TextStyle(
                      color: context.colors.textPrimary,
                      fontSize: 15,
                      height: 1.4,
                    ),
                  ),

                if (dataFormatada.isNotEmpty) ...[
                  const SizedBox(height: 12),
                  Text(
                    dataFormatada,
                    style: TextStyle(
                      color: context.colors.textDisabled,
                      fontSize: 13,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
