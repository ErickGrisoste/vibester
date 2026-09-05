import 'package:dio/dio.dart';

class ApiClient {
  //Guardado aqui pra ser lido pelo interceptor abaixo e anexado automaticamente
  //em toda chamada. É setado pela tela depois do login/registro dar certo.
  static String? token;

  static final Dio dio =
      Dio(
          BaseOptions(
            connectTimeout: const Duration(seconds: 10),
            receiveTimeout: const Duration(seconds: 10),
          ),
        )
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (options, handler) {
              if (token != null && token!.isNotEmpty) {
                options.headers['Authorization'] = 'Bearer $token';
              }
              handler.next(options);
            },
          ),
        )
        ..interceptors.add(
          LogInterceptor(
            requestHeader: true,
            requestBody: true,
            responseHeader: false,
            responseBody: true,
            error: true,
          ),
        );
}
