import 'package:dio/dio.dart';
import 'package:intl/intl.dart';
import 'package:mobile/models/event/event_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';

class EventService {
  List<EventModel> events = [];
  List<EventModel> nearbyEvents = [];
  EventModel? selectedEvent;

  Future<List<EventModel>> getEvents() async {
    try {
      final response = await ApiClient.dio.get(ApiEndpoints.events());
      final List data = response.data;
      events = data.map((json) => EventModel.fromJson(json)).toList();
      return events;
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao buscar eventos'));
    }
  }

  Future<List<EventModel>> getEventsFeatured() async {
    try {
      final response = await ApiClient.dio.get(ApiEndpoints.eventsFeatured());
      final List data = response.data;
      return data.map((json) => EventModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao buscar eventos em destaque'));
    }
  }

  Future<List<EventModel>> getEventsWeek({DateTime? date}) async {
    final dataFormatada = DateFormat(
      'yyyy-MM-dd',
    ).format(date ?? DateTime.now());

    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.eventsWeek(dataFormatada),
      );

      final List data = response.data;
      return data.map((json) => EventModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao buscar eventos da semana'));
    }
  }

  Future<List<EventModel>> getEventsNearby({
    required double latitude,
    required double longitude,
    double radiusKm = 20,
  }) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.eventNearby(),
        queryParameters: {
          'latitude': latitude.toString(),
          'longitude': longitude.toString(),
          'radiusKm': radiusKm,
        },
      );

      final List data = response.data;
      nearbyEvents = data.map((json) => EventModel.fromJson(json)).toList();
      return nearbyEvents;
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao buscar eventos próximos'));
    }
  }

  Future<List<EventModel>> getEventsByEstablishment(
    String establishmentId,
  ) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.eventsByEstablishment(establishmentId),
      );
      final List data = response.data;
      return data.map((json) => EventModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw Exception(
        apiErrorMessage(e, 'Erro ao buscar eventos do estabelecimento'),
      );
    }
  }

  Future<EventModel> getEventById(String eventId) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.eventDetail(eventId),
      );
      selectedEvent = EventModel.fromJson(response.data);
      return selectedEvent!;
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao buscar evento'));
    }
  }

  Future<List<EventModel>> getUserCheckIns(String userId) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.eventCheckins(userId),
      );
      final List data = response.data;
      return data.map((json) => EventModel.fromJson(json)).toList();
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao buscar seus rolês'));
    }
  }

  Future<bool> getCheckInStatus({
    required String eventId,
    required String userId,
  }) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.eventCheckinStatus(eventId, userId),
      );
      return response.data['checkedIn'] ?? false;
    } on DioException {
      return false;
    }
  }

  Future<void> checkIn({
    required String eventId,
    required String userId,
  }) async {
    try {
      await ApiClient.dio.post(
        ApiEndpoints.eventCheckin(eventId),
        data: {'userId': userId},
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao confirmar presença'));
    }
  }

  Future<void> checkOut({
    required String eventId,
    required String userId,
  }) async {
    try {
      await ApiClient.dio.delete(
        ApiEndpoints.eventCheckin(eventId),
        data: {'userId': userId},
      );
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao remover presença'));
    }
  }
}
