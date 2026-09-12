import 'package:dio/dio.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/service/api_endpoints.dart';
import 'package:mobile/service/api_error.dart';

class PaymentService {
  Future<String> createCheckout({
    required String productId,
    int quantity = 1,
    List<String> methods = const ['CARD'],
  }) async {
    try {
      final response = await ApiClient.dio.post(
        ApiEndpoints.checkout(),
        data: {
          'productId': productId,
          'quantity': quantity,
          'methods': methods,
        },
      );
      return response.data['url'];
    } on DioException catch (e) {
      throw Exception(
        apiErrorMessage(e, 'Erro ao gerar checkout de pagamento'),
      );
    }
  }
}
