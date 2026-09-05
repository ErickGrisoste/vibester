import 'package:mobile/models/event/lineup_model.dart';

class EventModel {
  final String? id;
  final String? placeId;
  final DateTime dataDoEvento;
  final String titulo;
  final List<LineupModel>? lineUp;
  final String categoria;
  final String localizacao;
  final String informacoes;
  final String artistas;
  final String imageUrl;
  bool isFavorite;
  final int totalConfirmed;
  final double latitude;
  final double longitude;
  final double distanceKm;
  final String organizador;
  final DateTime? dataFimEvento;
  final String ticketLink;
  final bool emDestaque;

  EventModel({
    this.id,
    this.placeId,
    required this.dataDoEvento,
    required this.titulo,
    this.lineUp,
    required this.categoria,
    required this.localizacao,
    required this.informacoes,
    required this.artistas,
    this.imageUrl = '',
    this.isFavorite = false,
    this.totalConfirmed = 0,
    this.latitude = 0,
    this.longitude = 0,
    this.distanceKm = 0,
    this.organizador = '',
    this.dataFimEvento,
    this.ticketLink = '',
    this.emDestaque = false,
  });

  //Json pra dart, é pra quando os dados virem da API, pra q eles possam ser usados pelo dart.
  // Não ha validação pra caso venha null, então atribui aqui valores para isso, apenas pra testes. Mudar depois!
  factory EventModel.fromJson(Map<String, dynamic> json) {
    return EventModel(
      id: json['id'],
      placeId: json['placeId'] ?? json['establishmentId'],
      dataDoEvento: json['startDate'] != null
          ? DateTime.parse(json['startDate'])
          : json['eventDate'] != null
          ? DateTime.parse(json['eventDate'])
          : DateTime.now(),
      titulo: json['name'] ?? json['title'] ?? 'Evento sem título',
      categoria: json['category'] ?? 'Sem categoria',
      localizacao: json['location'] ?? 'Local não informado',
      informacoes: json['info'] ?? json['informacoes'] ?? '',
      artistas: json['artists'] ?? '',
      imageUrl: json['photoUrl'] ?? json['imageUrl'] ?? '',
      totalConfirmed: json['totalConfirmed'] ?? 0,
      latitude: (json['latitude'] ?? 0).toDouble(),
      longitude: (json['longitude'] ?? 0).toDouble(),
      distanceKm: (json['distanceKm'] ?? 0).toDouble(),
      organizador: json['organizer'] ?? '',
      dataFimEvento: json['endDate'] != null
          ? DateTime.parse(json['endDate'])
          : null,
      ticketLink: json['ticketLink'] ?? '',
      emDestaque: json['isFeatured'] ?? false,
    );
  }

  EventModel copyWith({bool? isFavorite, int? totalConfirmed}) {
    return EventModel(
      id: id,
      placeId: placeId,
      dataDoEvento: dataDoEvento,
      titulo: titulo,
      lineUp: lineUp,
      categoria: categoria,
      localizacao: localizacao,
      informacoes: informacoes,
      artistas: artistas,
      imageUrl: imageUrl,
      isFavorite: isFavorite ?? this.isFavorite,
      totalConfirmed: totalConfirmed ?? this.totalConfirmed,
      latitude: latitude,
      longitude: longitude,
      distanceKm: distanceKm,
      organizador: organizador,
      dataFimEvento: dataFimEvento,
      ticketLink: ticketLink,
      emDestaque: emDestaque,
    );
  }

  //Dart pra json, é o contrario do de cima, pra quando for mandar pra API
  Map<String, dynamic> toJson() {
    return {
      'title': titulo,
      'eventDate': dataDoEvento.toIso8601String(),
      'category': categoria,
      'location': localizacao,
      'info': informacoes,
      'artists': artistas,
      'imageUrl': imageUrl,
      'placeId': placeId,
    };
  }
}
