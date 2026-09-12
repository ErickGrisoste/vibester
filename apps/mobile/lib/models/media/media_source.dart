/// De onde a pessoa escolheu tirar a mídia.
///
/// Existe para o fluxo de mídia não espalhar `bool fromCamera` nem strings
/// pelas telas: o sheet de origem devolve um destes e o `MediaFlow` decide o
/// caminho a partir dele.
enum MediaSource { camera, gallery }
