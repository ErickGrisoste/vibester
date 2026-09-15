# Vibester — Auditoria de Publicação (App Store e Google Play)

> Auditoria de `apps/mobile` + backend (`apps/services/*`) + `apps/landing-page` + `apps/admin`.
> 1ª rodada: 14/09/2026 (só leitura). 2ª rodada: implementação dos bloqueadores.
> 3ª rodada: 14–15/09/2026 — Android e verificação completa do monorepo.
>
> **Limite:** nada rodou contra o backend de produção nem em aparelho físico.
> O app foi instalado num emulador Android 16 (release) e compilado para iOS
> (release, sem assinatura). O backend foi testado com Postgres, Redis e
> Cassandra reais em Docker, do mesmo jeito que o CI.

## Executive Summary

Status: **NOT READY** — o código está pronto e testado nas duas plataformas;
faltam ícone, deploy, chave de upload do Android e teste em aparelho.

| Pendência que bloqueia envio | App Store | Google Play |
|---|---|---|
| Ícone real do app (adiado pelo produto) | ❌ | ❌ |
| Deploy de auth, user, notification, post e landing page | ❌ | ❌ |
| Keystore de upload + `android/key.properties` | — | ❌ |
| Teste manual em aparelho com duas contas | ❌ | ❌ |

---

# Bloqueadores implementados (2ª rodada)

| # | Problema | Situação | Onde |
|---|---|---|---|
| P0-1 | Sem denúncia de post/perfil | ✅ Menu ⋯ no feed, detalhe do post e perfil; grava no user-service e envia e-mail à moderação | `widgets/safety/report_sheet.dart`, user-service `report.service.ts`, notification-service `contentReported.handler.ts` |
| P0-2 | Sem bloqueio | ✅ Desfaz follow nos dois sentidos, impede seguir (403), esconde no feed e na busca, lista em Ajustes | `providers/safety/block_provider.dart`, user-service `block.service.ts` |
| P0-3 | Sem exclusão de conta | ✅ Ajustes → Excluir conta → `user.deleted` limpa auth, user, post (inclui mídia no R2) e notification | `delete_account_screen.dart`, `account-deletion.service.ts`, `userDeletion.service.ts`, `account-content-deletion.service.ts` |
| P0-4 | Sem Política/Termos | ✅ `/privacidade`, `/termos`, `/suporte`, `/excluir-conta`; links no app e aceite no cadastro | `apps/landing-page/src/app/*` |
| P0-5 | Ícone padrão do Flutter | ❌ Adiado | `AppIcon.appiconset`, `android/app/src/main/res/mipmap-*` |
| P0-6 | "Esqueci a senha" falso | ✅ Código por e-mail, 10 min, 5 tentativas, sem enumeração | `password-reset.service.ts`, `reset_password_screen.dart` |
| P0-7 | Vibester Club por checkout externo | ✅ Removido do app | `settings_screen.dart` |
| P0-8 | Sem moderação | ✅ E-mail por denúncia + suspensão de conta por rota de admin | `account-suspension.service.ts` |
| P1 | Contato, idade mínima, privacy manifest, iPhone only | ✅ | ver 2ª rodada no histórico do arquivo |

---

# Android / Google Play (3ª rodada)

## Achados e correções

| Achado | Risco | Correção |
|---|---|---|
| `applicationId = com.example.mobile` | **Bloqueador** — o Play recusa `com.example` | `com.victormarchi.vibester` (igual ao iOS); `namespace` e `MainActivity` movidos |
| Release assinado com chave de debug | **Bloqueador** — o Play recusa o AAB | `build.gradle.kts` lê `android/key.properties`; sem ele avisa no build e usa debug |
| Nome do app "mobile" | Alto | `android:label="Vibester"` |
| Backup automático ligado | Médio — sessão do `flutter_secure_storage` quebra ao restaurar em outro aparelho | `allowBackup="false"` e `fullBackupContent="false"` |
| Sem `<queries>` para `mailto` e Custom Tabs | Médio — "Ajuda e contato" e Termos/Privacidade podem não abrir no Android 11+ | `SENDTO mailto` e `CustomTabsService` no manifest |
| Sem URL pública de exclusão de conta | **Bloqueador** do formulário de Segurança dos dados | `https://vibester.com.br/excluir-conta` |

## Verificado sem mudança

- **Permissões** do APK final: INTERNET, CAMERA, RECORD_AUDIO, localização fina e aproximada, armazenamento só até Android 10/12 (`maxSdkVersion`), ACCESS_NETWORK_STATE e WAKE_LOCK (dos plugins). Sem `READ_MEDIA_*` — a galeria usa o Photo Picker do sistema, o que atende à política de fotos e vídeos do Play.
- **SDK:** `minSdk` 24, `targetSdk` 36 (atende ao requisito de API do Play).
- **Deep links** `vibester://profile|event|place`, **uCrop** declarado, **câmera opcional** (`required="false"`).
- **Código Dart:** nenhum `Platform.isIOS`/`isAndroid` nem widget Cupertino; voltar do sistema via `PopScope` (compatível com o voltar preditivo); telas usam `SafeArea` (Android 16 força borda a borda).

## Emulador (Pixel 9, Android 16 / API 36, APK release)

- Instalou e abriu sem crash nem erro no logcat.
- Tela de login renderizada corretamente, com conteúdo respeitando status bar e barra de gestos.
- O emulador ficou com você para testar; os fluxos logados não foram exercitados nele (sem conta e sem deploy das rotas novas). Eles estão cobertos pelos testes de widget e pela integração real do backend.

## Formulário de Segurança dos dados (Play Console)

Mesmo conteúdo da tabela "App Privacy" abaixo: dados coletados vinculados à conta, sem compartilhamento para publicidade, **criptografados em trânsito**, **com opção de exclusão** (in-app e URL `/excluir-conta`), app **não** voltado a crianças, classificação de conteúdo com UGC e referências a álcool.

---

# Testes executados (3ª rodada — tudo verde)

## App

| Verificação | Resultado |
|---|---|
| `flutter analyze` | Sem issues |
| `flutter test` | **267 passando** |
| `flutter build apk --release` | ✅ 79,9 MB, `com.victormarchi.vibester`, target 36 |
| Emulador Android 16 (release) | ✅ instala, abre, sem crash |
| `flutter build ios --release --no-codesign` | ✅ `Runner.app` 44,2 MB (valida `PrivacyInfo.xcprivacy`, `project.pbxproj`, `Info.plist`) |

## Backend — unitários + `tsc` (como o CI)

| Serviço | `tsc` | Testes |
|---|---|---|
| auth-service | ✅ | 103 |
| user-service | ✅ | 112 |
| notification-service | ✅ | 117 |
| post-service | ✅ | 202 (com Redis; `test:unit` do CI: 145) |
| feed-service | ✅ | 114 |
| event-service | ✅ | 82 |
| establishment-service | ✅ | 76 |
| payment-service | ✅ | 25 (cobertura 100% linhas) |
| scrapping-service | ✅ | 62 |

## Backend — integração com infraestrutura real (Docker, mesmas variáveis do CI)

| Serviço | Infra | Migrações | Testes |
|---|---|---|---|
| auth-service | Postgres + Redis | ✅ inclui `add_access_suspendedat` | **12/12** (2 rodadas) — inclui `account.real.spec.ts` novo |
| user-service | Postgres + Redis | ✅ inclui `add_userblock_contentreport` | **14/14** (2 rodadas) — inclui `safety.real.spec.ts` novo |
| notification-service | Postgres + Redis | ✅ | 3/3 |
| event-service | Postgres + Redis | ✅ | 29/29 |
| establishment-service | Postgres + Redis | ✅ | 20/20 |
| scrapping-service | Postgres | ✅ | 15/15 |
| feed-service | Cassandra | ✅ V010–V012 | 13/13 |
| post-service | Cassandra + Redis | ✅ V013–V015 | 30/30 |

Os specs reais novos exercitam, no banco de verdade: esqueci a senha → código →
nova senha → login; exclusão com JWT; suspensão bloqueando login; idade mínima;
bloqueio desfazendo follow e contadores; denúncia sem duplicar (unique real);
limpeza completa de conta excluída.

## Web

| Projeto | Resultado |
|---|---|
| landing-page | `tsc` ✅ · `next build` ✅ (`/privacidade`, `/termos`, `/suporte`, `/excluir-conta`) |
| admin | `vite build` ✅ · lint ❌ 11 erros / 2 avisos **antigos** (código não alterado; regras de estilo/performance do React, sem erro de execução; admin não tem CI) |

## Defeito encontrado e corrigido durante a verificação

**user-service — testes de integração rodavam em paralelo sem aviso.** O
`vitest.integration.config.ts` usava `poolOptions.forks.singleFork`, opção
removida no Vitest 4 (versão do serviço: 4.1.9). Com um único arquivo de teste
real isso nunca aparecia; com dois, um arquivo apagava os dados do outro
(404/500). Trocado por `fileParallelism: false`, a opção dos demais serviços.
No auth-service (Vitest 3.2.6, onde `singleFork` ainda funciona) a mesma linha
foi adicionada preventivamente. Comprovado: cada arquivo passava sozinho,
juntos falhavam; depois da correção, 2 rodadas completas verdes. O código
original (worktree do commit `16a92bd`) também foi executado para comparação.

## Observações de ambiente (não são defeitos)

- Rodar a integração sem `JWT_SECRET` faz auth, scrapping e feed falharem na validação de env — o CI define essas variáveis; localmente elas precisam ser passadas.
- O `node_modules` local do feed-service estava desatualizado (faltavam `prom-client` e `@fastify/rate-limit`); `npm ci` resolveu.
- O `npm ci` do establishment-service precisa de `DATABASE_URL` definida por causa do `prisma generate` no postinstall (o CI já define).

---

# Apple Guidelines Checklist

| Guideline | Status | Action |
|---|---|---|
| 1.1 / 1.2 UGC | ✅ código · integração real | Deploy; teste com 2 contas |
| 1.5 Suporte | ✅ | Support URL no ASC |
| 2.1 Completude | ✅ | Deploy |
| 2.3.6 Classificação etária | ⚠️ manual | Questionário (álcool + UGC) |
| 2.3.8 Ícone | ❌ | Gerar ícone |
| 2.4.1 iPad | ✅ iPhone only | — |
| 3.1.1 IAP | ✅ sem compras | — |
| 5.1.1(i) Política | ✅ | Deploy da landing; revisão jurídica |
| 5.1.1(v) Exclusão de conta | ✅ | Deploy + teste real |
| Privacy manifest | ✅ build iOS ok | Validar e-mail do TestFlight |

# Privacy Audit (App Privacy / Segurança dos dados)

| Data | Collected | Linked | Tracking | Purpose |
|---|---|---|---|---|
| Nome e @usuário | Sim | Sim | Não | Funcionalidade |
| E-mail | Sim | Sim | Não | Funcionalidade |
| User ID | Sim | Sim | Não | Funcionalidade |
| Fotos e vídeos | Sim | Sim | Não | Funcionalidade |
| Outro conteúdo (bio, legenda, denúncias) | Sim | Sim | Não | Funcionalidade |
| Localização precisa (só na busca, sem histórico) | Sim | Sim | Não | Funcionalidade |
| Interação (curtidas, follows, check-ins, bloqueios) | Sim | Sim | Não | Funcionalidade |
| Data de nascimento | Sim | Sim | Não | Funcionalidade (18+) |
| IDs de dispositivo, anúncios, analytics, crash, push | Não | — | — | — |

---

# Pendências abertas (não bloqueiam o envio)

- P1-5: rotas antigas (seguir, curtir, post, notificações) ainda aceitam o id do cliente em vez do JWT.
- Check-ins do event-service não são apagados na exclusão de conta (serviço sem Kafka).
- "Seguir lugar" não persiste; localização pedida ao abrir HOJE; JWT de 1h sem refresh.
- Lint do admin (13 problemas antigos).

# Antes do upload

1. **Ícone** real (iOS `AppIcon.appiconset` e Android `mipmap-*`).
2. **Deploy** de auth-service e user-service (migrações), notification-service, post-service e landing page. Conferir tópicos Kafka `user.deleted`, `auth.password.reset` e `content.reported`.
3. **Secret** `auth-admin-secret` com `ADMIN_API_KEY`.
4. **`JWT_SECRET` idêntico** no auth-service e no user-service em produção.
5. **SMTP** configurado e caixa contato@vibester.com.br recebendo.
6. **Android:** gerar keystore de upload (`keytool -genkey -v -keystore ~/upload-keystore.jks -keyalg RSA -keysize 2048 -validity 10000 -alias upload`), criar `android/key.properties`, ativar Play App Signing e gerar `flutter build appbundle`.
7. **Teste manual** em iPhone e Android com duas contas: cadastro (menor recusado), esqueci a senha, publicar, denunciar, bloquear, suspender pela API, excluir conta; negar câmera, fotos e localização; modo avião.
8. **Lojas:** Privacy Policy URL, Support URL, App Privacy / Segurança dos dados, URL de exclusão de conta (Play), classificação etária, screenshots da build atual, notas de review (`APP_STORE_REVIEW_NOTES.md`) com as contas de teste.
