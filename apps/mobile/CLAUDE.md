# Mobile (Flutter)

> Contexto específico do app mobile do Vibester, em Flutter/Dart, localizado em `apps/mobile`.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto; este arquivo prevalece em convenções específicas do app mobile. Código-fonte é sempre a fonte de verdade final.
>
> Este é o único cliente do monorepo — não tem lógica de negócio própria, apenas consome as APIs dos microserviços (auth, user, event, establishment, post, feed, notification, payment) através de um único `baseUrl` que já roteia por prefixo de serviço. Nunca duplique regra de negócio aqui (cálculo de preço, validação de dono de recurso, etc.) — se algo parece exigir isso, é o backend que deveria estar validando, não o app.

---

## Responsabilidade do App

O app mobile é a única interface de usuário do Vibester (não há web app hoje). Ele cobre: cadastro/login, feed de posts, descoberta de eventos e estabelecimentos (incluindo geolocalização), perfil de usuário e seguidores, notificações, checkout de pagamento e configurações de conta.

Toda a comunicação com o backend passa por um `baseUrl` único (`ApiEndpoints.baseUrl`, hoje fixo em `https://api.vibester.com.br`), com cada endpoint prefixado pelo nome do serviço dono da rota (`/auth/...`, `/user/...`, `/event/...`, `/establishment/...`, `/post/...`, `/feed/...`, `/notification/...`, `/payment/...`) — presumivelmente um API Gateway/reverse proxy roteando por path. Ao adicionar uma chamada nova, confirme o prefixo correto olhando o `CLAUDE.md` do serviço correspondente em `apps/services/<nome>-service/CLAUDE.md`, não assuma pelo nome do model no app.

---

## Stack e Dependências

- **Flutter/Dart** (SDK `^3.11.0`), gerenciamento de estado com **`provider`** (`ChangeNotifier` + `MultiProvider` em `main.dart`)
- **`dio`** para HTTP, com uma única instância singleton (`ApiClient.dio`) compartilhada por todos os services
- **`flutter_secure_storage`** para persistir a sessão (token JWT + dados do usuário) no Keychain/Keystore nativo
- **`geolocator`** para localização do dispositivo (eventos/estabelecimentos próximos), **`flutter_map` + `latlong2`** para mapas
- **`image_picker`** para seleção de foto (avatar, posts), upload direto para o R2 via URL pré-assinada obtida do backend
- **`cached_network_image`** para exibir imagens de rede com cache em disco/memória — use sempre este widget para imagem remota, nunca `Image.network` puro
- **`google_fonts`** (fonte Inter) + `ThemeExtension<AppColors>` (`lib/theme/`) para o design system
- **`email_validator`**, **`intl`** (formatação de data/hora, localizado em `pt_BR`), **`diacritic`**, **`pinput`** (código de verificação), **`font_awesome_flutter`**, **`url_launcher`**
- Não introduza uma segunda solução de state management (Bloc, Riverpod, GetX) ou um segundo client HTTP — o padrão do projeto é `provider` + `dio`.

---

## Estrutura de Pastas

```
lib/
  models/       um arquivo por entidade, organizados por domínio (event/, feed/, user/, place/, notification/, highlights/)
                → sempre com fromJson (API → Dart) e, quando o model é enviado de volta, toJson (Dart → API)
  service/      um arquivo por domínio (event/, feed/, user/, posts/, notification/, payment/, places/, location/, highlights/)
                → chama ApiClient.dio + ApiEndpoints, nunca é ChangeNotifier, nunca guarda estado de UI
  providers/    ChangeNotifier por domínio compartilhado entre telas (events/, feed/, notification/, place/, user/)
                → orquestra service + cache em memória com janela de staleness (ver lib/utils/data_freshness.dart)
  screens/      uma tela por arquivo, organizadas por área (events/, feed/, home/, places/, register/, search/, settings/, user/, favorites/, highlights/)
  widgets/      componentes reutilizáveis (buttons/, cards/<domínio>/, indicators/, navbar/, text-field/)
  theme/        app_colors.dart (ThemeExtension), app_theme.dart, theme_extensions.dart (context.colors)
  routes/       app_routes.dart — só as constantes de nome de rota; o switch de onGenerateRoute vive em main.dart
  utils/        helpers sem estado (data_freshness.dart, relative_time.dart, search_state.dart, etc.)
```

Não existe pasta `test/` neste projeto hoje — `flutter_test`/`flutter_lints` estão como dev dependency mas não há nenhum teste escrito, e não há workflow de CI (`.github/workflows`) rodando `flutter analyze`/`flutter test` para o mobile. Ao adicionar lógica não-trivial (parsing de model, regra de staleness, cálculo em um provider), considere ser o primeiro a escrever um teste para ela em vez de assumir que "não é o padrão do projeto".

### Padrão de uma feature nova

1. **Model** em `models/<domínio>/`: classe simples com `fromJson` fazendo a tradução dos campos da API (em inglês: `name`, `username`, `followers`, `startDate`...) para os campos do model (frequentemente em português: `nome`, `nomeUsuario`, `seguidores`, `dataDoEvento`...). Essa tradução PT/EN é intencional e já estabelecida (ver `EventModel`, `UserModel`) — ao adicionar um campo novo, mapeie-o no `fromJson`/`toJson`, nunca renomeie um campo existente do model só porque a API mudou de nome, pois isso quebra todos os call-sites em português espalhados pelas telas.
2. **Service** em `service/<domínio>/`: métodos `async` que chamam `ApiClient.dio` + `ApiEndpoints.<rota>()`, parseiam a resposta em model(s), e convertem `DioException` em `Exception(mensagem)` legível — sempre lendo `e.response?.data?['message']` com um fallback em português (ver qualquer service existente para o padrão exato). Não deixe uma `DioException` crua subir até a tela.
3. Se o dado precisa ser compartilhado entre telas ou cacheado, crie/estenda um **Provider** (`ChangeNotifier`) em `providers/<domínio>/`, seguindo o padrão de staleness já usado em `EventsListProvider`/`PublicationListProvider`/`NotificationProvider`: guardar `_lastFetchedAt`, checar `isDataStale(...)` antes de refazer a busca, expor `isLoading`/erro como campos simples, e sempre ter um parâmetro `force` para pull-to-refresh. Se o dado é local de uma tela só, um `StatefulWidget` com `setState` é suficiente (ver `LoginScreen`) — não crie um Provider para estado que nunca sai da tela.
4. Registrar o Provider novo no `MultiProvider` de `main.dart`, se for compartilhado.
5. **Tela** em `screens/<área>/`, reaproveitando os widgets de `widgets/buttons`, `widgets/cards`, `widgets/text-field` e as cores via `context.colors.<nome>` (extensão de `theme_extensions.dart`) — evite hardcodar hex novo se já existir uma cor equivalente em `AppColors`.
6. Adicionar a rota em `routes/app_routes.dart` (só a constante) e o `case` correspondente em `main.dart` (`onGenerateRoute`), escolhendo a transição (`_slideRoute`/`_fadeRoute`/`_scaleRoute`) consistente com o grupo de telas ao redor (ex.: todas as de `events/` usam slide/scale, todas as de `register/` usam fade).

---

## Segurança — obrigatório em qualquer alteração

1. **`LogInterceptor` do Dio está sempre ativo, incondicionalmente** (`ApiClient.dio`, `requestBody: true`), inclusive em build de release — isso significa que o **corpo de `POST /auth/login` e `POST /auth/register`, incluindo a senha em texto plano, vai para o log do dispositivo** (visível via `adb logcat`/Console em apps instalados fora de debug). Ao mexer em `api_client.dart`, condicione esse interceptor a `kDebugMode` (`import 'package:flutter/foundation.dart'`) em vez de deixá-lo incondicional — isso é a prioridade de segurança nº 1 deste app.
2. **Sessão (token JWT) só deve viver em `flutter_secure_storage`** (`AuthStorageService`), nunca em `SharedPreferences` ou arquivo comum. `ApiClient.token` (variável estática em memória, usada pelo interceptor de `Authorization`) e o storage seguro devem ser mantidos em sincronia manualmente: todo fluxo que seta uma sessão nova (login, registro) precisa setar `ApiClient.token` **antes** de qualquer chamada autenticada subsequente (ver comentário em `login_screen.dart`), e todo `logout()`/`clearSession()` precisa limpar os dois ao mesmo tempo (ver `UserProvider.logout`) — não adicione um novo lugar que só limpe um dos dois.
3. **Nunca hardcode chave de API, secret ou URL de ambiente sensível no código Dart** — hoje não há nenhuma (verificado), e não deve passar a haver; se uma integração nova precisar de credencial, ela deve vir do backend (o app não deve falar direto com serviços terceiros que exijam segredo, como já é o caso do upload ao R2, que usa uma URL pré-assinada gerada pelo backend, sem credencial no app).
4. **Permissões nativas devem sempre corresponder a uma feature realmente usada**: hoje `Info.plist`/`AndroidManifest.xml` declaram câmera, galeria e localização, alinhadas a `image_picker`/`geolocator`. Ao adicionar uma permissão nova (contatos, bluetooth, notificações push nativas, etc.), declare a descrição de uso (`NS*UsageDescription` no iOS) com uma frase clara do motivo, e trate os três estados de permissão (concedida/negada/negada permanentemente) como já é feito em `LocationService.getCurrentPosition` — não assuma que a permissão sempre foi concedida.
5. **IDs sensíveis (`userId`, `accountId`, `followerId`) são sempre enviados no corpo da requisição, nunca derivados de um token no backend** (isso é verdade nos serviços atuais — ver os `CLAUDE.md` de `event-service`/`post-service`, que documentam ausência de verificação de dono do lado do servidor). Isso significa que o app é hoje uma das poucas barreiras contra o usuário errado sendo referenciado numa ação: sempre use o `accountId`/`id` vindo de `context.read<UserProvider>().user`, nunca um valor reconstruído manualmente ou vindo de um argumento de rota não confiável.
6. **Erros de rede exibidos ao usuário devem ser sempre a mensagem tratada** (`e.response?.data?['message']` com fallback em português), nunca `e.toString()` de uma `DioException` bruta em um `SnackBar`/`Text` visível — reserve `debugPrint(e.toString())`/logging para depuração local, seguindo o padrão já usado em `LoginScreen._entrar`.

---

## Performance — obrigatório em qualquer alteração

1. **Toda lista alimentada por API que pode crescer sem limite deve seguir o padrão de staleness + cursor já estabelecido**: cache em memória no Provider com `_lastFetchedAt`/`isDataStale` (janela padrão de 5 minutos, `lib/utils/data_freshness.dart`) para não refazer a busca a cada entrada na tela, e paginação por cursor (`nextCursor`, `loadMore()`) para não carregar a lista inteira de uma vez — ver `PublicationListProvider` como referência completa (staleness na carga inicial + `hasMore`/`isLoadingMore` para scroll infinito). Ao adicionar uma lista nova que widget-side já suporta cursor no backend, não implemente um scroll "carrega tudo de uma vez" — siga esse padrão.
2. **Mutações que afetam contador/estado visível (curtir, seguir, check-in) devem ser otimistas**: atualize o estado local e chame `notifyListeners()` antes da resposta da API, e só reverta em caso de erro real (ver `PublicationListProvider.toggleLike`, que inclusive trata 409 — "já curtido"/"já descurtido" — como não-erro, sem reverter a UI). Isso evita que a interface pareça travada esperando round-trip de rede.
3. **Cache de imagem já é ajustado manualmente em `main.dart`** (`PaintingBinding.instance.imageCache`, 300 imagens / 200MB, para evitar que fotos de tela cheia expulsem thumbnails do cache) — se uma tela nova exibir muitas imagens grandes simultaneamente (grid, carrossel), prefira `cached_network_image` (já padrão) e avalie se esse limite ainda é suficiente antes de aumentá-lo às cegas.
4. **`ApiClient.dio` tem timeout de 10s** para conexão e recebimento — qualquer chamada nova herda isso automaticamente por usar a instância compartilhada; não crie uma instância `Dio()` nova sem timeout (a única exceção intencional hoje é o upload direto ao R2 em `_uploadToR2`, que usa uma instância separada de propósito para não anexar o header `Authorization` da sua própria API a um domínio de terceiro).
5. **Há duplicação real de código de upload entre `service/posts/post_service.dart` e `service/user/user_service.dart`** (`UploadUrlResult`, `_getUploadUrls`, `_uploadToR2`, `_uploadImages`, `_normalizeUrl` — praticamente idênticos nos dois arquivos). Se for mexer nesse fluxo (novo tipo de mídia, retry, barra de progresso), extraia para um serviço compartilhado (ex.: `service/media_upload_service.dart`) em vez de criar uma terceira cópia.
6. **Larguras fixas em pixel são comuns nas telas atuais** (ex.: `SizedBox(width: 350, ...)` em `LoginScreen`) em vez de responsivas via `MediaQuery`/`LayoutBuilder`/`Expanded` — funciona no aparelho de referência usado no design, mas não é garantia de bom encaixe em todas as larguras de tela. Não é obrigatório refatorar telas existentes, mas evite reproduzir esse padrão em telas novas sem necessidade.

---

## Configuração / Ambiente

- **Não há separação de ambiente hoje**: `ApiEndpoints.baseUrl` é uma constante fixa (`https://api.vibester.com.br`) — não existe `--dart-define`, `flutter_dotenv` ou equivalente para apontar o app para um backend de desenvolvimento/staging. Ao testar localmente contra um backend local, isso precisa ser trocado manualmente nesse arquivo (e revertido antes de commitar) até que uma solução de ambiente seja introduzida.
- **Verifique o prefixo de rota antes de adicionar um endpoint novo em `api_endpoints.dart`**: já existem pelo menos duas inconsistências no arquivo atual — `createProfile()` usa `/api/users/profile` (prefixo `api`, não `user`, diferente de todas as outras rotas de perfil) e `establishmentPosts()` usa `/establishments/$id/posts` (sem o prefixo `post`/`establishment` esperado pelo padrão do gateway usado nas demais rotas). Confirme contra o `CLAUDE.md`/rotas reais do serviço de destino antes de assumir que uma URL existente está correta, e não copie o padrão delas para uma rota nova sem verificar.
- **Localização é inicializada uma vez no boot** (`initializeDateFormatting('pt_BR', null)` em `main()`) — qualquer formatação de data nova deve usar `intl` já localizado em `pt_BR`, não strings de mês/dia hardcoded.

---

## Design

O diretório `design/` na raiz do monorepo (assets, mockups, styleguide, link do protótipo Figma) é a fonte de verdade visual do produto — antes de estilizar uma tela nova, confira se a cor/tipografia já está representada em `AppColors`/`AppTheme` (`lib/theme/`). Hoje há mistura de cores vindas do tema (`context.colors.ambar`, `context.colors.grey`) com hex hardcoded inline (`Color(0xFF141414)`, `Colors.redAccent`, `Colors.red`) na mesma tela (ver `LoginScreen`) — ao tocar numa tela existente ou criar uma nova, prefira sempre `context.colors.<nome>`; se a cor necessária não existir em `AppColors`, adicione-a lá em vez de hardcodar mais um hex solto.
