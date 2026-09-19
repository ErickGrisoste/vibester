import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile/models/media/picked_media.dart';
import 'package:mobile/service/media/media_failure.dart';
import 'package:mobile/service/media/media_processor.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/theme/vibester_page_route.dart';
import 'package:mobile/widgets/media/media_preview.dart';

/// Recebe a seleção confirmada e informa o progresso do processamento.
typedef PreviewConfirm<T> =
    Future<T> Function(
      List<PickedMedia> items,
      ValueChanged<double> onProgress,
    );

/// Prévia do que veio da galeria, antes de processar e anexar.
///
/// "Trocar" reabre a galeria sem sair daqui; tirar o último item da seleção
/// equivale a cancelar; fechar durante o processamento cancela a compressão.
/// Devolve o resultado de [onConfirm] ou `null`.
class MediaPreviewScreen<T> extends StatefulWidget {
  final List<PickedMedia> items;
  final PreviewConfirm<T> onConfirm;
  final Future<List<PickedMedia>> Function()? onReplace;
  final Duration? maxVideoDuration;

  const MediaPreviewScreen({
    super.key,
    required this.items,
    required this.onConfirm,
    this.onReplace,
    this.maxVideoDuration,
  });

  static Future<T?> open<T>(
    BuildContext context, {
    required List<PickedMedia> items,
    required PreviewConfirm<T> onConfirm,
    Future<List<PickedMedia>> Function()? onReplace,
    Duration? maxVideoDuration,
  }) async {
    final result = await Navigator.of(context).push(
      vibesterSlideRoute(
        MediaPreviewScreen<T>(
          items: items,
          onConfirm: onConfirm,
          onReplace: onReplace,
          maxVideoDuration: maxVideoDuration,
        ),
        const RouteSettings(name: 'media-preview'),
      ),
    );
    return result as T?;
  }

  @override
  State<MediaPreviewScreen<T>> createState() => _MediaPreviewScreenState<T>();
}

class _MediaPreviewScreenState<T> extends State<MediaPreviewScreen<T>> {
  late List<PickedMedia> _items = List.of(widget.items);
  final _progress = ValueNotifier<double?>(null);
  bool _confirming = false;

  @override
  void dispose() {
    if (_confirming) MediaProcessor.cancel();
    _progress.dispose();
    super.dispose();
  }

  String get _confirmLabel {
    if (_items.length > 1) return 'Usar ${_items.length}';
    return _items.first.isVideo ? 'Usar vídeo' : 'Usar foto';
  }

  Future<void> _replace() async {
    try {
      final items = await widget.onReplace!();
      if (items.isNotEmpty && mounted) setState(() => _items = items);
    } on MediaException catch (e) {
      _showError(e.message);
    }
  }

  void _remove(int index) {
    if (_items.length <= 1) {
      Navigator.of(context).pop();
      return;
    }
    setState(() => _items = [..._items]..removeAt(index));
  }

  Future<void> _confirm() async {
    _confirming = true;
    // A barra só aparece com vídeo: foto processa rápido demais para ela.
    _progress.value = _items.any((i) => i.isVideo) ? 0 : null;
    try {
      final result = await widget.onConfirm(
        _items,
        (p) => _progress.value = _progress.value == null ? null : p,
      );
      if (mounted) Navigator.of(context).pop(result);
    } on MediaException catch (e) {
      if (e.failure != MediaFailure.cancelled) _showError(e.message);
    } finally {
      _confirming = false;
      if (mounted) _progress.value = null;
    }
  }

  void _showError(String message) {
    if (!mounted) return;
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(message)));
  }

  @override
  Widget build(BuildContext context) {
    return Theme(
      data: AppTheme.dark,
      child: AnnotatedRegion<SystemUiOverlayStyle>(
        value: SystemUiOverlayStyle.light,
        child: Scaffold(
          body: MediaPreview(
            items: _items,
            confirmLabel: _confirmLabel,
            retakeLabel: widget.onReplace != null ? 'Trocar' : null,
            onRetake: widget.onReplace != null ? _replace : null,
            onRemove: _remove,
            onClose: () => Navigator.of(context).maybePop(),
            onConfirm: _confirm,
            progress: _progress,
            maxVideoDuration: widget.maxVideoDuration,
          ),
        ),
      ),
    );
  }
}
