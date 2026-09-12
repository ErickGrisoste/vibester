class ApiEndpoints {
  static const String baseUrl = 'https://api.vibester.com.br';

  // Auth
  static String register() => '$baseUrl/auth/register';
  static String login() => '$baseUrl/auth/login';
  static String verifyEmail() => '$baseUrl/auth/verify-email';

  // User
  static String createProfile() => '$baseUrl/api/users/profile';
  static String getProfileById(String id) => '$baseUrl/user/users/profile/$id';
  static String updateInfo() => '$baseUrl/user/users/profile/info';
  static String updateBio() => '$baseUrl/user/users/profile/bio';
  static String updateAvatar() => '$baseUrl/user/users/profile/avatar';
  static String increaseFollowers() =>
      '$baseUrl/user/users/profile/followers/increase';
  static String decreaseFollowers() =>
      '$baseUrl/user/users/profile/followers/decrease';
  static String checkFollowing(String followerId, String followingId) =>
      '$baseUrl/user/users/$followerId/follows/$followingId';
  static String generateShareLink() => '$baseUrl/user/users/share';
  static String resolveShareLink(String token) =>
      '$baseUrl/user/users/share/$token';

  // Events
  static String events() => '$baseUrl/event/events';
  static String eventsFeatured() => '$baseUrl/event/events/featured';
  static String eventNearby() => '$baseUrl/event/events/nearby';
  static String eventDetail(String eventId) => '$baseUrl/event/events/$eventId';
  static String eventsWeek(String date) =>
      '$baseUrl/event/events/week?date=$date';
  static String eventCheckin(String eventId) =>
      '$baseUrl/event/events/$eventId/checkin';
  static String eventCheckinStatus(String eventId, String userId) =>
      '$baseUrl/event/events/$eventId/checkin/$userId';
  static String eventCheckins(String userId) =>
      '$baseUrl/event/events/checkins/$userId';
  static String establishmentsNearby({
    required double latitude,
    required double longitude,
    int radiusKm = 7,
  }) =>
      '$baseUrl/establishment/establishments/nearby?latitude=$latitude&longitude=$longitude&radiusKm=$radiusKm';

  // Establishments
  static String establishments() => '$baseUrl/establishment/establishments';
  static String establishmentsByCategory(String category) =>
      '$baseUrl/establishment/establishments?category=$category';
  static String establishmentDetail(String establishmentId) =>
      '$baseUrl/establishment/establishments/$establishmentId';
  static String openEstablishments() =>
      '$baseUrl/establishment/establishments/open';
  static String rateEstablishment(String establishmentId) =>
      '$baseUrl/establishment/establishments/$establishmentId/rating';

  // Payment
  static String checkout() => '$baseUrl/payment/checkout';

  // Highlights
  static String userPosts(String accountId) =>
      '$baseUrl/post/users/$accountId/posts';
  static String establishmentPosts(String establishmentId) =>
      '$baseUrl/post/establishments/$establishmentId/posts';

  //Post
  static String posts() => '$baseUrl/post/posts';
  static String postsUploadUrl() => '$baseUrl/post/posts/upload-url';
  static String likePost(String postId) => '$baseUrl/post/posts/$postId/likes';

  //Feed
  static String feed(String userId) => '$baseUrl/feed/feed/$userId';

  // Search
  static String searchUsers(String q, {int limit = 10, int page = 1}) =>
      '$baseUrl/user/users/search?q=${Uri.encodeComponent(q)}&limit=$limit&page=$page';

  // Notifications
  static String notifications(String userId, {int? limit, DateTime? before}) {
    final params = <String, String>{};
    if (limit != null) params['limit'] = '$limit';
    if (before != null) {
      params['before'] = before.toUtc().toIso8601String();
    }

    if (params.isEmpty) {
      return '$baseUrl/notification/notifications/$userId';
    }

    final query = params.entries
        .map((e) => '${e.key}=${Uri.encodeComponent(e.value)}')
        .join('&');
    return '$baseUrl/notification/notifications/$userId?$query';
  }

  static String notificationsUnreadCount(String userId) =>
      '$baseUrl/notification/notifications/$userId/unread-count';

  static String notificationsMarkRead(String userId) =>
      '$baseUrl/notification/notifications/$userId/read';
}
