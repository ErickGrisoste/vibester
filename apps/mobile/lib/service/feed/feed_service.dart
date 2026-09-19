import 'package:dio/dio.dart';
import 'package:mobile/models/feed/feed_item_model.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';

class FeedPage {
  final List<FeedItemModel> items;
  final String? nextCursor;

  FeedPage({required this.items, required this.nextCursor});
}

class FeedService {
  Future<FeedPage> getFeed({
    required String userId,
    String? cursor,
    int limit = 20,
  }) async {
    try {
      final response = await ApiClient.dio.get(
        ApiEndpoints.feed(userId),
        queryParameters: {'cursor': ?cursor, 'limit': limit},
      );

      final data = response.data;
      final items = (data['items'] as List)
          .map((json) => FeedItemModel.fromJson(json))
          .toList();

      return FeedPage(items: items, nextCursor: data['nextCursor']);
    } on DioException catch (e) {
      throw Exception(apiErrorMessage(e, 'Erro ao buscar feed'));
    }
  }
}
