import 'package:flutter/material.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/service/event/event_service.dart';
import 'package:mobile/utils/data_freshness.dart';

class EventsListProvider extends ChangeNotifier {
  final EventService _service = EventService();

  List<EventModel> _events = [];
  bool isLoading = false;
  String? error;
  DateTime? _eventsLastFetchedAt;

  List<EventModel> get events => _events;

  List<EventModel> get favorites =>
      _events.where((e) => e.isFavorite == true).toList();

  List<EventModel> _checkIns = [];
  bool isLoadingCheckIns = false;
  String? checkInsError;

  List<EventModel> get checkIns => _checkIns;

  /// Ver [PlaceListProvider.fetchPlaces] para a lógica de staleness: reusa os
  /// dados em memória enquanto estiverem dentro da janela de validade, e
  /// refaz a busca automaticamente após esse período ou quando [force].
  Future<void> fetchEvents({bool force = false}) async {
    if (_events.isNotEmpty && !force && !isDataStale(_eventsLastFetchedAt)) {
      return;
    }

    isLoading = true;
    error = null;
    notifyListeners();

    try {
      _events = await _service.getEvents();
      _eventsLastFetchedAt = DateTime.now();
    } catch (e) {
      error = 'Não foi possível carregar os eventos';
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<void> fetchCheckIns({
    required String userId,
    bool force = false,
  }) async {
    if (_checkIns.isNotEmpty && !force) {
      return;
    }

    isLoadingCheckIns = true;
    checkInsError = null;
    notifyListeners();

    try {
      _checkIns = await _service.getUserCheckIns(userId);
    } catch (e) {
      checkInsError = 'Não foi possível carregar os eventos confirmados';
    } finally {
      isLoadingCheckIns = false;
      notifyListeners();
    }
  }

  // Eventos em destaque
  List<EventModel> _featuredEvents = [];
  bool isLoadingFeatured = false;
  String? featuredError;
  DateTime? _featuredLastFetchedAt;

  List<EventModel> get featuredEvents => _featuredEvents;

  Future<void> fetchFeaturedEvents({bool force = false}) async {
    if (_featuredEvents.isNotEmpty &&
        !force &&
        !isDataStale(_featuredLastFetchedAt)) {
      return;
    }

    isLoadingFeatured = true;
    notifyListeners();

    try {
      final resultado = await _service.getEventsFeatured();
      // Só substitui a lista guardada se a busca realmente trouxe dados
      if (resultado.isNotEmpty) {
        _featuredEvents = resultado;
        featuredError = null;
      }
      _featuredLastFetchedAt = DateTime.now();
    } catch (e) {
      featuredError = 'Não foi possível carregar os destaques';
    } finally {
      isLoadingFeatured = false;
      notifyListeners();
    }
  }

  // Eventos da semana
  List<EventModel> _weekEvents = [];
  bool isLoadingWeek = false;
  String? weekError;
  DateTime? _weekLastFetchedAt;

  List<EventModel> get weekEvents => _weekEvents;

  /// Quando [date] é informado, é sempre uma janela diferente sendo pedida
  /// explicitamente, então a busca ignora o cache de staleness.
  Future<void> fetchWeekEvents({DateTime? date, bool force = false}) async {
    if (date == null &&
        _weekEvents.isNotEmpty &&
        !force &&
        !isDataStale(_weekLastFetchedAt)) {
      return;
    }

    isLoadingWeek = true;
    notifyListeners();

    try {
      final resultado = await _service.getEventsWeek(date: date);
      if (resultado.isNotEmpty) {
        _weekEvents = resultado;
        weekError = null;
      }
      _weekLastFetchedAt = DateTime.now();
    } catch (e) {
      weekError = 'Não foi possível carregar os eventos da semana';
    } finally {
      isLoadingWeek = false;
      notifyListeners();
    }
  }

  //isso meche só com dados locais, eu não mexi ainda, mas quando conectar a API certo isso vai ter que mudar
  void toggleFavorite(String titulo) {
    final event = _events.firstWhere((e) => e.titulo == titulo);
    event.isFavorite = !event.isFavorite;
    notifyListeners();
  }
}
