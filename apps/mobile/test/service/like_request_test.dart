import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mobile/models/feed/publication_model.dart';
import 'package:mobile/providers/feed/publication_list_provider.dart';
import 'package:mobile/providers/user/user_provider.dart';
import 'package:mobile/service/api_client.dart';
import 'package:mobile/theme/app_theme.dart';
import 'package:mobile/widgets/indicators/like_indicator.dart';
import 'package:provider/provider.dart';

import '../helpers/pump_app.dart';

/// Garante que o toque no coração vira requisição HTTP de verdade — com a
/// rota, o método e o `userId` que o post-service espera — e não só uma
/// troca visual.
void main() {
  setUpAll(setUpTestEnvironment);

  late List<RequestOptions> requisicoes;
  late Interceptor capturador;

  setUp(() {
    requisicoes = [];
    capturador = InterceptorsWrapper(
      onRequest: (options, handler) {
        requisicoes.add(options);
        handler.resolve(
          Response(
            requestOptions: options,
            statusCode: options.method == 'POST' ? 201 : 204,
          ),
        );
      },
    );
    ApiClient.dio.interceptors.insert(0, capturador);
  });

  tearDown(() => ApiClient.dio.interceptors.remove(capturador));

  Future<PublicationListProvider> montar(
    WidgetTester tester, {
    bool curtido = false,
  }) async {
    final feed = PublicationListProvider()
      ..addPublication(
        PublicationModel(
          id: 'post-1',
          autor: '@ana',
          autorProfileImage: '',
          publicationImage: '',
          description: '',
          publicatedAt: DateTime(2026, 9, 1),
          likes: 3,
          isLiked: curtido,
        ),
      );
    final usuario = UserProvider()..setUser(fakeUser());

    await tester.pumpWidget(
      MultiProvider(
        providers: [
          ChangeNotifierProvider.value(value: feed),
          ChangeNotifierProvider.value(value: usuario),
        ],
        child: MaterialApp(
          theme: AppTheme.dark,
          home: Scaffold(
            body: Center(
              child: Consumer<PublicationListProvider>(
                builder: (_, p, _) =>
                    LikeIndicator(publication: p.publications.first),
              ),
            ),
          ),
        ),
      ),
    );
    return feed;
  }

  testWidgets('curtir faz POST /post/posts/:id/likes e soma 1', (tester) async {
    final feed = await montar(tester);

    await tester.tap(find.byType(LikeIndicator));
    await tester.pumpAndSettle();

    expect(requisicoes, hasLength(1));
    final req = requisicoes.single;
    expect(req.method, 'POST');
    expect(req.uri.path, '/post/posts/post-1/likes');
    expect(req.data, {'userId': 'account-1'});

    expect(feed.publications.first.isLiked, isTrue);
    expect(feed.publications.first.likes, 4);
  });

  testWidgets('descurtir faz DELETE na mesma rota e subtrai 1', (tester) async {
    final feed = await montar(tester, curtido: true);

    await tester.tap(find.byType(LikeIndicator));
    await tester.pumpAndSettle();

    expect(requisicoes.single.method, 'DELETE');
    expect(requisicoes.single.uri.path, '/post/posts/post-1/likes');
    expect(feed.publications.first.isLiked, isFalse);
    expect(feed.publications.first.likes, 2);
  });
}
