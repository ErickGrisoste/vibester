class UserSearchResult {
  final String accountId;
  final String? name;
  final String? username;
  final String? avatarUrl;
  final int followers;

  UserSearchResult({
    required this.accountId,
    this.name,
    this.username,
    this.avatarUrl,
    required this.followers,
  });

  factory UserSearchResult.fromJson(Map<String, dynamic> json) {
    return UserSearchResult(
      accountId: json['accountId'] ?? '',
      name: json['name'],
      username: json['username'],
      avatarUrl: json['avatarUrl'],
      followers: json['followers'] ?? 0,
    );
  }
}

class UserModel {
  String? id;
  String? userID;
  String? token;
  String? accountId;
  String nome;
  String nomeUsuario;
  String bio;
  int seguidores;
  int seguindo;
  int eventosVisitados;
  int totalPosts;
  String fotoPerfil;
  String interesses;
  String email;
  String telefone;
  String dataNascimento;
  String cidade;
  String createdAt;
  String updatedAt;

  UserModel({
    this.id,
    this.userID,
    this.token,
    this.accountId,
    required this.nome,
    required this.nomeUsuario,
    this.bio = '',
    this.seguidores = 0,
    this.seguindo = 0,
    this.eventosVisitados = 0,
    this.totalPosts = 0,
    this.fotoPerfil = '',
    this.interesses = '',
    required this.email,
    this.telefone = '',
    required this.dataNascimento,
    this.cidade = '',
    this.createdAt = '',
    this.updatedAt = '',
  });

  //Esse aqui é pra resposta do login
  factory UserModel.fromLoginJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['authId'],
      token: json['accessToken'],
      accountId: json['accountId'],
      nome: '',
      nomeUsuario: '',
      email: '',
      dataNascimento: '',
    );
  }

  factory UserModel.fromProfileJson(
    Map<String, dynamic> json, {
    String? accountId,
    String? token,
  }) {
    return UserModel(
      id: json['profileId'],
      userID: accountId ?? json['userID'],
      token: token,
      accountId: accountId,
      nome: json['name'] ?? '',
      nomeUsuario: json['username'] ?? '',
      bio: json['bio'] ?? '',
      seguidores: json['followers'] ?? 0,
      seguindo: json['following'] ?? 0,
      totalPosts: json['totalPosts'] ?? 0,
      fotoPerfil: json['avatarUrl'] ?? '',
      email: '',
      dataNascimento: '',
      createdAt: json['createdAt'] ?? '',
      updatedAt: json['updatedAt'] ?? '',
    );
  }

  //Json pra dart, é pra quando os dados virem da API.
  //Não ha validação pra caso venha null, valores reserva apenas para testes. Mudar depois!
  factory UserModel.fromJson(Map<String, dynamic> json) {
    return UserModel(
      id: json['id'],
      nome: json['name'] ?? '',
      nomeUsuario: json['username'] ?? '',
      bio: json['bio'] ?? '',
      seguidores: json['followersCount'] ?? 0,
      seguindo: json['followingCount'] ?? 0,
      eventosVisitados: json['eventsVisited'] ?? 0,
      fotoPerfil: json['avatarUrl'] ?? '',
      email: json['email'] ?? '',
      telefone: json['phone'] ?? '',
      dataNascimento: json['bornAt'] ?? '',
      cidade: json['city'] ?? '',
    );
  }

  //Dart pra json, pra quando for mandar pra API
  Map<String, dynamic> toJson() {
    return {
      'name': nome,
      'username': nomeUsuario,
      'bio': bio,
      'avatarUrl': fotoPerfil,
      'email': email,
      'phone': telefone,
      'bornAt': dataNascimento,
      'city': cidade,
    };
  }
}
