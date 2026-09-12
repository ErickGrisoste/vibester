# Mobile (Flutter)

> Contexto específico do app mobile do Vibester, em Flutter/Dart, localizado em `apps/mobile`.
> Este documento complementa o `CLAUDE.md` da raiz do monorepo. Em caso de conflito, o `CLAUDE.md` raiz prevalece nas diretrizes gerais de produto; este arquivo prevalece em convenções específicas do app mobile. Código-fonte é sempre a fonte de verdade final.
>
> Este é o único cliente do monorepo — não tem lógica de negócio própria, apenas consome as APIs dos microserviços (auth, user, event, establishment, post, feed, notification, payment) através de um único `baseUrl` que já roteia por prefixo de serviço. Nunca duplique regra de negócio aqui (cálculo de preço, validação de dono de recurso, etc.) — se algo parece exigir isso, é o backend que deveria estar validando, não o app.

---

## Responsabilidade do App

O app mobile é a única interface de usuário do Vibester (não há web app hoje). Ele cobre: cadastro/login, feed de posts, descoberta de eventos e estabelecimentos (incluindo geolocalização), perfil de usuário e seguidores, notificações, checkout de pagamento e configurações de conta.

### Navegação (uma só, quatro destinos e uma ação)

`HomeScreen` (`screens/home/home_screen.dart`) é a casca: um `IndexedStack` com
quatro destinos e a `VibesterNavbar` embaixo.

```text
FEED      → screens/feed/feed_screen.dart       social (tela inicial do app)
EXPLORAR  → screens/explore/explore_screen.dart busca (lugares, rolês, pessoas) + categorias
  (+)     → screens/feed/new_publication_screen.dart   publicar (ação, não destino)
HOJE      → screens/home/today_screen.dart      descoberta: agora, hoje, perto, em alta, semana
VOCÊ      → screens/user/user_profile_screen.dart identidade + atalho pra "Seus rolês"
```

Notificações vivem no sino do cabeçalho de HOJE (`/notifications`); salvos e
check-ins vivem em `/saved` (`screens/saved/saved_screen.dart`), acessível pelo
perfil. Não existe mais aba dentro de aba: a `TabBar` FEED/DESTAQUES/EM ALTA e
a aba de favoritos foram removidas.

O design system está documentado em [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) —
leia antes de criar componente novo.

Toda a comunicação com o backend passa por um `baseUrl` único (`ApiEndpoints.baseUrl`, hoje fixo em `https://api.vibester.com.br`), com cada endpoint prefixado pelo nome do serviço dono da rota (`/auth/...`, `/user/...`, `/event/...`, `/establishment/...`, `/post/...`, `/feed/...`, `/notification/...`, `/payment/...`) — presumivelmente um API Gateway/reverse proxy roteando por path. Ao adicionar uma chamada nova, confirme o prefixo correto olhando o `CLAUDE.md` do serviço correspondente em `apps/services/<nome>-service/CLAUDE.md`, não assuma pelo nome do model no app.

---

## Stack e Dependências

- **Flutter/Dart** (SDK `^3.11.0`), gerenciamento de estado com **`provider`** (`ChangeNotifier` + `MultiProvider` em `main.dart`)
- **`dio`** para HTTP, com uma única instância singleton (`ApiClient.dio`) compartilhada por todos os services
- **`flutter_secure_storage`** para persistir a sessão (token JWT + dados do usuário) no Keychain/Keystore nativo
- **`geolocator`** para localização do dispositivo (eventos/estabelecimentos próximos), **`flutter_map` + `latlong2`** para mapas
- **Mídia**: **`camera`** (câmera própria do app), **`image_picker`** (galeria e câmera do sistema como reserva), **`image_cropper`** (recorte do avatar) e **`flutter_image_compress`** (resize + JPEG antes do upload) — todos atrás da camada de mídia descrita em [Mídia](#mídia-câmera-e-galeria); upload direto para o R2 via URL pré-assinada obtida do backend
- **`cached_network_image`** para exibir imagens de rede com cache em disco/memória — use sempre este widget para imagem remota, nunca `Image.network` puro
- **Fontes empacotadas** (sem `google_fonts`): **Outfit** (400–800) como fonte do tema e **DM Mono** (300/400/500) para metadado — ver `DESIGN_SYSTEM.md` e `lib/theme/app_typography.dart`
- **`email_validator`**, **`intl`** (formatação de data/hora, localizado em `pt_BR`), **`diacritic`**, **`pinput`** (código de verificação), **`font_awesome_flutter`**, **`url_launcher`**, **`share_plus`**, **`app_links`** (deep link `vibester://profile/{token}`), **`shared_preferences`** (tema e interesses)
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
  screens/      uma tela por arquivo, organizadas por área (home/, explore/, feed/, events/, places/, user/, saved/, notification/, register/, settings/, onboarding/, highlights/)
  widgets/      componentes reutilizáveis (common/, graffiti/, motion/, navigation/, buttons/, cards/<domínio>/, indicators/, onboarding/, text-field/)
                → common/ é o núcleo do design system; graffiti/ é a linguagem urbana (Grain, SprayGlow, BrushRule, StickerTag, ScribbleMark);
                  navigation/ é a navbar (VibesterNavbar + forma, fundo, indicador, item e ação central) — ver §10 do DESIGN_SYSTEM.md
  theme/        app_colors.dart (ThemeExtension), app_typography.dart, app_spacing.dart (AppSpacing/AppRadius/AppStroke),
                app_motion.dart, app_theme.dart, theme_extensions.dart (context.colors / context.typography)
  routes/       app_routes.dart — só as constantes de nome de rota; o switch de onGenerateRoute vive em main.dart
  utils/        helpers sem estado (data_freshness.dart, relative_time.dart, search_state.dart, etc.)
```

Existe suíte de testes em `test/` (208 testes, `flutter test` verde): `theme/` guarda a paleta, `utils/` cobre a lógica temporal do evento, `service/` cobre o tratamento de erro da API e a expiração do JWT, `media/` cobre a máquina de estados da câmera, o seletor e cada estado sem preview da câmera, `widgets/` cobre os componentes do design system e `screens/` monta **toda** tela em três larguras e nos dois temas. Essa última é o QA visual automatizado — em debug, estouro de layout vira erro de framework e reprova o teste. Ainda não há workflow de CI (`.github/workflows`) rodando isso para o mobile; ao mexer em tela ou componente, rode `flutter analyze && flutter test` (os dois passam limpos hoje) e acrescente o caso novo à bateria.

### Padrão de uma feature nova

1. **Model** em `models/<domínio>/`: classe simples com `fromJson` fazendo a tradução dos campos da API (em inglês: `name`, `username`, `followers`, `startDate`...) para os campos do model (frequentemente em português: `nome`, `nomeUsuario`, `seguidores`, `dataDoEvento`...). Essa tradução PT/EN é intencional e já estabelecida (ver `EventModel`, `UserModel`) — ao adicionar um campo novo, mapeie-o no `fromJson`/`toJson`, nunca renomeie um campo existente do model só porque a API mudou de nome, pois isso quebra todos os call-sites em português espalhados pelas telas.
2. **Service** em `service/<domínio>/`: métodos `async` que chamam `ApiClient.dio` + `ApiEndpoints.<rota>()`, parseiam a resposta em model(s), e convertem `DioException` em `Exception(mensagem)` legível — sempre via `apiErrorMessage(e, 'fallback em português')` (`service/api_error.dart`), que lê `message` **ou** `error` (auth-service e payment-service usam `error`), tolera corpo em texto puro do gateway/R2 e troca 5xx por mensagem genérica. Nunca indexe `e.response?.data?['message']` direto: se o corpo for `String`, isso lança `TypeError` de dentro do `catch`. Não deixe uma `DioException` crua subir até a tela.
3. Se o dado precisa ser compartilhado entre telas ou cacheado, crie/estenda um **Provider** (`ChangeNotifier`) em `providers/<domínio>/`, seguindo o padrão de staleness já usado em `EventsListProvider`/`PublicationListProvider`/`NotificationProvider`: guardar `_lastFetchedAt`, checar `isDataStale(...)` antes de refazer a busca, expor `isLoading`/erro como campos simples, e sempre ter um parâmetro `force` para pull-to-refresh. Se o dado é local de uma tela só, um `StatefulWidget` com `setState` é suficiente (ver `LoginScreen`) — não crie um Provider para estado que nunca sai da tela.
4. Registrar o Provider novo no `MultiProvider` de `main.dart`, se for compartilhado.
5. **Tela** em `screens/<área>/`, montada com os componentes de `widgets/common` (`ScreenHeader`, `SectionHeader`, `VibesterButton`, `VibesterTag`, `VibesterChip`, `VibesterImage`, `VibesterSkeleton`, `VibesterState`) e os tokens via `context.colors.<nome>`, `context.typography.<token>`, `AppSpacing`/`AppRadius`. Não hardcode hex nem número solto de espaçamento — ver `DESIGN_SYSTEM.md`.
6. Adicionar a rota em `routes/app_routes.dart` (só a constante) e o `case` correspondente em `main.dart` (`onGenerateRoute`), escolhendo a transição de `theme/vibester_page_route.dart` consistente com o grupo ao redor: `vibesterSlideRoute` para tela secundária, `vibesterFadeRoute` para contexto amplo (auth, onboarding, home) e `vibesterDetailRoute` para detalhe (acompanhado de `Hero` na imagem de origem).

---

## Segurança — obrigatório em qualquer alteração

1. **`LogInterceptor` do Dio agora só é registrado em `kDebugMode`** (`api_client.dart`). Ele imprime `requestBody` e `requestHeader`, ou seja, o corpo de `POST /auth/login`/`/auth/register` com a senha em texto plano e o header `Authorization` com o JWT — incondicional, isso ia para o log do aparelho em release, legível via `adb logcat`/Console. **Não volte a registrá-lo fora do guard.**
2. **Sessão (token JWT) só deve viver em `flutter_secure_storage`** (`AuthStorageService`), nunca em `SharedPreferences` ou arquivo comum. `ApiClient.token` (variável estática em memória, usada pelo interceptor de `Authorization`) e o storage seguro devem ser mantidos em sincronia manualmente: todo fluxo que seta uma sessão nova (login, registro) precisa setar `ApiClient.token` **antes** de qualquer chamada autenticada subsequente (ver comentário em `login_screen.dart`), e todo `logout()`/`clearSession()` precisa limpar os dois ao mesmo tempo (ver `UserProvider.logout`) — não adicione um novo lugar que só limpe um dos dois. O JWT vence em 1h e não há refresh token: no boot, sessão com `exp` vencido é descartada (`ApiClient.isTokenExpired` em `main()`), e um 401 numa rota autenticada fora de `/auth/` dispara `ApiClient.onSessionExpired`, que `main.dart` usa para deslogar e abrir o login.
3. **Nunca hardcode chave de API, secret ou URL de ambiente sensível no código Dart** — hoje não há nenhuma (verificado), e não deve passar a haver; se uma integração nova precisar de credencial, ela deve vir do backend (o app não deve falar direto com serviços terceiros que exijam segredo, como já é o caso do upload ao R2, que usa uma URL pré-assinada gerada pelo backend, sem credencial no app).
4. **Permissões nativas devem sempre corresponder a uma feature realmente usada**: hoje `Info.plist`/`AndroidManifest.xml` declaram câmera, galeria e localização, alinhadas a `camera`/`image_picker`/`geolocator` (a galeria usa o Photo Picker do sistema, por isso o Android não declara `READ_MEDIA_IMAGES`; a câmera é `required=false`). Ao adicionar uma permissão nova (contatos, bluetooth, notificações push nativas, etc.), declare a descrição de uso (`NS*UsageDescription` no iOS) com uma frase clara do motivo, e trate os três estados de permissão (concedida/negada/negada permanentemente) como já é feito em `LocationService.getCurrentPosition` — não assuma que a permissão sempre foi concedida.
5. **IDs sensíveis (`userId`, `accountId`, `followerId`) são sempre enviados no corpo da requisição, nunca derivados de um token no backend** (isso é verdade nos serviços atuais — ver os `CLAUDE.md` de `event-service`/`post-service`, que documentam ausência de verificação de dono do lado do servidor). Isso significa que o app é hoje uma das poucas barreiras contra o usuário errado sendo referenciado numa ação: sempre use o `accountId`/`id` vindo de `context.read<UserProvider>().user`, nunca um valor reconstruído manualmente ou vindo de um argumento de rota não confiável.
6. **Erros de rede exibidos ao usuário devem ser sempre a mensagem tratada** (`apiErrorMessage` com fallback em português), nunca `e.toString()` de uma `DioException` bruta em um `SnackBar`/`Text` visível — reserve `debugPrint(e.toString())`/logging para depuração local, seguindo o padrão já usado em `LoginScreen._entrar`.

---

## Performance — obrigatório em qualquer alteração

1. **Toda lista alimentada por API que pode crescer sem limite deve seguir o padrão de staleness + cursor já estabelecido**: cache em memória no Provider com `_lastFetchedAt`/`isDataStale` (janela padrão de 5 minutos, `lib/utils/data_freshness.dart`) para não refazer a busca a cada entrada na tela, e paginação por cursor (`nextCursor`, `loadMore()`) para não carregar a lista inteira de uma vez — ver `PublicationListProvider` como referência completa (staleness na carga inicial + `hasMore`/`isLoadingMore` para scroll infinito). Ao adicionar uma lista nova que widget-side já suporta cursor no backend, não implemente um scroll "carrega tudo de uma vez" — siga esse padrão.
2. **Mutações que afetam contador/estado visível (curtir, seguir, check-in) devem ser otimistas**: atualize o estado local e chame `notifyListeners()` antes da resposta da API, e só reverta em caso de erro real (ver `PublicationListProvider.toggleLike`, que inclusive trata 409 — "já curtido"/"já descurtido" — como não-erro, sem reverter a UI). Isso evita que a interface pareça travada esperando round-trip de rede.
3. **Cache de imagem já é ajustado manualmente em `main.dart`** (`PaintingBinding.instance.imageCache`, 300 imagens / 200MB, para evitar que fotos de tela cheia expulsem thumbnails do cache) — se uma tela nova exibir muitas imagens grandes simultaneamente (grid, carrossel), prefira `cached_network_image` (já padrão) e avalie se esse limite ainda é suficiente antes de aumentá-lo às cegas.
4. **`ApiClient.dio` tem timeout de 10s** para conexão e recebimento — qualquer chamada nova herda isso automaticamente por usar a instância compartilhada; não crie uma instância `Dio()` nova sem timeout (a única exceção intencional hoje é o upload direto ao R2 em `MediaUploadService`, que usa uma instância separada — com timeouts próprios — de propósito para não anexar o header `Authorization` da sua própria API a um domínio de terceiro).
5. **Upload de mídia vive só em `service/media_upload_service.dart`** (usado por post e avatar). Ele pede as URLs com `files: [{type, contentType}]` e faz o PUT com o **mesmo** content-type com que a URL foi assinada — o formato legado `count` assinava tudo como `image/jpeg` e o R2 recusava qualquer PNG. O content-type vem do `MediaItem` (definido por quem gerou o arquivo), não da extensão; os PUTs rodam no máximo 3 por vez, em stream. Novo tipo de mídia, retry ou barra de progresso entram lá, nunca numa cópia.
6. **Nada de largura fixa em pixel para conteúdo.** As telas de auth e o antigo `PrimaryButton` usavam `SizedBox(width: 350)`/`fixedSize: Size(300, 60)`, que estoura em aparelho estreito; hoje tudo é fluido (`Expanded`, `MediaQuery`, `LayoutBuilder`). Trilhos horizontais dimensionam o cartão a partir da largura da tela (ver `_HeroRail` em `today_screen.dart`). Não reintroduza medida fixa de conteúdo.

---

## Mídia (câmera e galeria)

Toda foto do app passa por uma camada só — nenhuma tela instancia `ImagePicker` ou `CameraController`:

```text
tela ──▶ MediaFlow (widgets/media/media_flow.dart)
           ├─ showMediaSourceSheet ─ câmera ou galeria
           ├─ CameraScreen → AppCamera → CameraSession   (pacote camera; revisão "Usar foto/Refazer")
           ├─ MediaPickerService                          (image_picker: galeria, câmera do sistema de reserva)
           ├─ MediaPreviewScreen                          (prévia da galeria)
           └─ MediaProcessor                              (recorte do avatar, resize, JPEG, sem EXIF)
                 ▼
             MediaItem (arquivo + MediaKind + contentType) ──▶ PostService/UserService ──▶ MediaUploadService
```

- **Post**: `MediaFlow.pickImages(context, maxItems: n)`; **avatar**: `MediaFlow.pickAvatar(context)` (câmera frontal, recorte 1:1, 512px). Os tamanhos e qualidades vivem só em `models/media/image_spec.dart` (`ImageSpec.post` = 1920px na maior dimensão, a referência do post-service).
- **Nada sobe antes da confirmação**: captura → revisão/prévia → processamento → o upload só acontece no "Publicar"/ao salvar o avatar. Foto descartada não custa rede.
- **Processamento sempre em JPEG, sem EXIF** (a localização GPS da câmera não vai para post público) e com a rotação do EXIF aplicada.
- **Estado da câmera é um enum só** (`CameraStatus`: loading, ready, capturing, permissionDenied, permissionBlocked, unavailable, error) — não espalhe `bool isLoading/hasError`. A sessão libera o hardware quando o app vai para segundo plano e reabre na volta; nunca deixe tela preta ou carregando eterno.
- **Multi-imagem**: a camada inteira trabalha com lista, mas o composer limita a 1 (`_maxMedia` em `new_publication_screen.dart`) porque o feed ainda desenha só a primeira foto. Suba esse limite junto com o carrossel que lê `media` — não antes.
- **Vídeo**: `MediaKind.video` e o upload em stream já existem; falta captura (`enableAudio` + `NSMicrophoneUsageDescription`/`RECORD_AUDIO`), compressão de vídeo e capa (`thumbnailUrl`).

---

## Configuração / Ambiente

- **Não há separação de ambiente hoje**: `ApiEndpoints.baseUrl` é uma constante fixa (`https://api.vibester.com.br`) — não existe `--dart-define`, `flutter_dotenv` ou equivalente para apontar o app para um backend de desenvolvimento/staging. Ao testar localmente contra um backend local, isso precisa ser trocado manualmente nesse arquivo (e revertido antes de commitar) até que uma solução de ambiente seja introduzida.
- **Dados inventados são proibidos.** Foram removidos do app: as "ofertas exclusivas" com descontos e nomes de bares fixos no código, as seis avaliações fictícias de `place_reviews_screen`, o "12k seguidores" do `PlaceStatsBar` e a foto de banco de imagens usada como banner de todo estabelecimento. Se a API não devolve o dado, a seção não aparece — ver §77 do briefing.
- **Verifique o prefixo de rota antes de adicionar um endpoint novo em `api_endpoints.dart`**: ainda existe uma inconsistência no arquivo atual — `createProfile()` usa `/api/users/profile` (prefixo `api`, que o Traefik não roteia: responde 404; o método não é chamado, o perfil é criado pelo auth-service). Confirme contra o `CLAUDE.md`/rotas reais do serviço de destino antes de assumir que uma URL existente está correta, e não copie o padrão delas para uma rota nova sem verificar.
- **Localização é inicializada uma vez no boot** (`initializeDateFormatting('pt_BR', null)` em `main()`) — qualquer formatação de data nova deve usar `intl` já localizado em `pt_BR`, não strings de mês/dia hardcoded.

---

## Design

O diretório `design/` na raiz do monorepo (assets, mockups, styleguide, link do protótipo Figma) é a fonte de verdade visual do produto — antes de estilizar uma tela nova, confira se a cor/tipografia já está representada em `AppColors`/`AppTheme` (`lib/theme/`). Hoje há mistura de cores vindas do tema (`context.colors.ambar`, `context.colors.grey`) com hex hardcoded inline (`Color(0xFF141414)`, `Colors.redAccent`, `Colors.red`) na mesma tela (ver `LoginScreen`) — ao tocar numa tela existente ou criar uma nova, prefira sempre `context.colors.<nome>`; se a cor necessária não existir em `AppColors`, adicione-a lá em vez de hardcodar mais um hex solto.
