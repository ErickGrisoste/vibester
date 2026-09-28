class PlaceModel {
  final String? id;
  final String nome;
  final int nivelMovimento;
  final String categoria;
  final double avaliacao;
  final String nivelPrecoMedio;
  final String bio;
  final String endereco;
  final int qtdAvaliacoes;
  final List<double> distribuicao;
  final double? distancia;
  final String profileImage;
  final String bannerImage;
  final double? latitude;
  final double? longitude;

  /// Fotos do ambiente do lugar (fachada, decoração, pista) na ordem em que o
  /// estabelecimento as publica. Só vêm no detalhe
  /// (`GET /establishment/establishments/:id`, campo `images`) — a listagem
  /// não as devolve, então numa `PlaceModel` vinda de lista isso é vazio.
  final List<String> imagensAmbiente;

  bool isFavorite;

  PlaceModel({
    this.id,
    required this.nome,
    required this.nivelMovimento,
    required this.categoria,
    required this.avaliacao,
    required this.nivelPrecoMedio,
    required this.bio,
    required this.endereco,
    required this.distribuicao,
    required this.qtdAvaliacoes,
    this.profileImage = '',
    this.bannerImage = '',
    this.latitude,
    this.longitude,
    this.distancia,
    this.imagensAmbiente = const [],
    this.isFavorite = false,
  });

  //Json pra dart, é pra quando os dados virem da API, pra q eles possam ser usados pelo dart
  factory PlaceModel.fromJson(Map<String, dynamic> json) {
    final location = json['location'] as Map<String, dynamic>?;

    final distanceToKm = (json['distanceTo'] as num?)?.toDouble();

    return PlaceModel(
      id: json['id'],
      nome: json['name'] ?? '',
      nivelMovimento: json['movementLevel'] ?? json['nivelMovimento'] ?? 0,
      categoria: json['category'] ?? '',
      avaliacao:
          ((json['averageRating'] ?? json['rating']) as num?)?.toDouble() ?? 0,
      nivelPrecoMedio: json['priceIndicator'] ?? '',
      bio: json['bio'] ?? '',
      endereco: json['endereco'] ?? json['endereco'] ?? '',
      qtdAvaliacoes: json['reviewCount'] ?? json['qtdAvaliacoes'] ?? 0,
      distribuicao: (json['ratingDistribution'] ?? json['distribuicao']) != null
          ? List<double>.from(
              (json['ratingDistribution'] ?? json['distribuicao']),
            )
          : [],
      profileImage:
          json['photoUrl'] ?? json['profileImage'] ?? json['icon'] ?? '',
      bannerImage: json['banner'] ?? json['bannerUrl'] ?? '',
      latitude:
          (location?['latitude'] as num?)?.toDouble() ??
          (json['latitude'] as num?)?.toDouble(),
      longitude:
          (location?['longitude'] as num?)?.toDouble() ??
          (json['longitude'] as num?)?.toDouble(),
      distancia: distanceToKm != null ? distanceToKm * 1000 : null,
      imagensAmbiente: _parseImagens(json['images']),
    );
  }

  /// `images` vem como `[{ id, url, source, position }]` já ordenado por
  /// `position` pelo establishment-service. Reordenamos mesmo assim (custo
  /// desprezível numa galeria) e descartamos entrada sem `url`, para uma foto
  /// quebrada não virar um item vazio na galeria.
  static List<String> _parseImagens(dynamic raw) {
    if (raw is! List || raw.isEmpty) return const [];

    final itens = raw.whereType<Map>().toList()
      ..sort((a, b) {
        final pa = (a['position'] as num?)?.toInt() ?? 0;
        final pb = (b['position'] as num?)?.toInt() ?? 0;
        return pa.compareTo(pb);
      });

    return [
      for (final item in itens)
        if (item['url'] is String && (item['url'] as String).isNotEmpty)
          item['url'] as String,
    ];
  }

  //Dart pra json, é o contrario do de cima, pra quando for mandar pra API
  Map<String, dynamic> toJson() {
    return {
      'name': nome,
      'movementLevel': nivelMovimento,
      'category': categoria,
      'rating': avaliacao,
      'priceLevel': nivelPrecoMedio,
      'bio': bio,
      'address': endereco,
      'reviewCount': qtdAvaliacoes,
      'ratingDistribution': distribuicao,
      'profileImage': profileImage,
      'banner': bannerImage,
      'location': {'latitude': latitude, 'longitude': longitude},
    };
  }
}
