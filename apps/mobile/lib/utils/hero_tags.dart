import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/models/place/place_model.dart';

/// Tags de `Hero` para a transição card → detalhe. Usa o id do modelo com um
/// fallback por identidade de objeto (id pode vir nulo da API) — o mesmo tag
/// precisa ser usado tanto no card de origem quanto na tela de detalhe.
String eventImageHeroTag(EventModel event) =>
    'event-image-${event.id ?? identityHashCode(event)}';

String placeImageHeroTag(PlaceModel place) =>
    'place-image-${place.id ?? identityHashCode(place)}';
