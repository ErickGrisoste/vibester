/// Duração em relógio — `1:05`, `0:42` — para limite, cronômetro e
/// miniatura de vídeo.
String formatClock(Duration duration) {
  final minutes = duration.inMinutes;
  final seconds = duration.inSeconds.remainder(60).toString().padLeft(2, '0');
  return '$minutes:$seconds';
}
