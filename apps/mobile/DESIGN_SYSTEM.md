# Vibester — Design System

> Referência do sistema visual do app mobile. O código em `lib/theme/` e
> `lib/widgets/` é a fonte de verdade; este documento explica **por que** cada
> peça existe e **quando** usá-la.

---

## 1. A ideia

O Vibester é uma **plataforma urbana de descoberta**, não um catálogo de
eventos. A linguagem visual segue disso: a interface se comporta como um muro
de cartazes da cidade — foto grande, tipografia que grita, etiqueta impressa
por cima, textura de papel e concreto — mas com o rigor de um produto digital
premium: hierarquia clara, espaço negativo, movimento com propósito.

```text
STREET ART  +  PREMIUM DIGITAL PRODUCT
```

A regra que separa uma coisa da outra: **arte urbana é linguagem de marca, não
decoração**. Todo elemento gráfico tem função (ver §5). Se um sticker não está
destacando nada, ele sai.

---

## 2. Cor — `lib/theme/app_colors.dart`

A paleta é patrimônio da marca e **não muda**. Os seis tokens originais
seguem intactos:

| Token      | Escuro     | Papel                                        |
|------------|------------|----------------------------------------------|
| `noturno`  | `#0C0910`  | Fundo de tela                                 |
| `navy`     | `#17112A`  | Base das superfícies                          |
| `ambar`    | `#F88806`  | Marca, ação principal, estado ativo           |
| `brasa`    | `#FF4D1C`  | Urgência: agora, ao vivo, cheio, erro social  |
| `grey`     | `#94A3B8`  | Neutro de traço                               |
| `darkGrey` | `#0E0E0E`  | Legado (superfícies antigas)                  |

Mais os tokens de texto (`textPrimary`…`textDisabled`), `border` e `error`.

### Superfícies derivadas (novas, sem cor nova)

Profundidade se resolve por **camada**, não por matiz. Tudo abaixo é
`navy`/`grey`/preto em opacidade — o app continua cromaticamente idêntico:

- `background` — alias de `noturno`.
- `surface` — primeira camada (bloco, campo, célula).
- `surfaceRaised` — segunda camada (sheet, dock).
- `hairline` — fio estrutural de 1px.
- `outline` — contorno visível (chip, moldura).
- `scrim` / `photoScrim` — véu de leitura sobre foto (preto real: escurecer com
  `noturno` tingiria a foto de roxo).
- `live` — alias semântico de `brasa`, para "acontecendo agora".
- `ink` / `onFill(cor)` / `onAmbar` / `onBrasa` — **cor de texto sobre
  preenchimento sólido**. Nunca escreva `Colors.white` em cima de `ambar` ou
  `brasa`: branco sobre `ambar` dá **2,47:1**, abaixo do piso de 3:1 da WCAG
  (era o rótulo de todo botão principal, chip selecionado e tag de marca).
  `onFill` escolhe entre a tinta escura e o branco pela razão de contraste
  real — sobre `ambar` a tinta dá 8:1, e de quebra fica com cara de tinta
  preta sobre papel laranja, que é a direção de cartaz do produto.

**Nunca** hardcode um hex novo. Se falta uma cor, ela é derivada de um token.

---

## 3. Tipografia — `lib/theme/app_typography.dart`

Duas vozes, e a separação entre elas é o que dá o tom editorial:

```text
OUTFIT   → emoção, marca, comunicação, ação
DM MONO  → contexto, sistema, informação, detalhe
```

**Outfit** (400/500/600/700/800) é a fonte do tema (`ThemeData.fontFamily`),
então todo `Text` já nasce nela. Escala agressiva no topo, com tracking
negativo crescente:

`displayHuge` 44 · `displayLarge` 34 · `displayMedium` 27 · `headlineLarge` 24 ·
`headlineMedium` 21 · `headlineSmall` 18 · `titleLarge/Medium/Small` ·
`bodyLarge/Medium/Small` · `labelLarge/Medium/Small`

**DM Mono** é sempre opt-in, sempre curta, sempre com tracking positivo:

| Token | Uso |
|---|---|
| `mono` | metadado principal do card (data, hora, distância) |
| `monoSmall` | metadado secundário |
| `monoMicro` | selo mínimo, rótulo de dock, contador |
| `monoEyebrow` | linha que abre uma seção (`01 / ACONTECENDO AGORA`) |
| `monoDisplay` | número grande de sistema (dia do mês, contador de perfil) |
| `monoTag` | texto de sticker/etiqueta sobre imagem |

Caixa alta é decisão do call-site, não do token — nome próprio não vira
uppercase. **DM Mono nunca em texto longo.**

---

## 4. Espaço, raio e traço — `lib/theme/app_spacing.dart`

`AppSpacing`: `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 24 · xxl 32 · huge 48`,
mais `screen 20` (margem lateral de toda tela) e `dockGap 108` (respiro no fim
de lista rolável, pro dock não cobrir o último item).

`AppRadius` — o raio comunica a natureza do elemento, então **não é tudo
arredondado igual**:

- `none` — cartaz, quina viva
- `sticker 4` — etiqueta, recorte de papel
- `sm 8` — miniatura, chip retangular
- `md 14` — superfície padrão
- `lg 24` — hero, bottom sheet
- `pill` — ação, filtro, dock

**Canto rasgado**: cards de conteúdo (evento, lugar, post, foto de perfil) usam
`BorderRadius.only(topLeft, topRight, bottomRight)` — a quina inferior esquerda
fica reta. É a assinatura de forma do produto.

`AppStroke`: `hairline 1 · regular 1.5 · marker 2.5`.

---

## 5. Grafite — `lib/widgets/graffiti/`

Cada peça tem **uma** função. Sem função, não entra.

| Peça | Função | Regra |
|---|---|---|
| `Grain` | atmosfera | opacidade ≤ 0.08; um `drawPoints` por pintura, `shouldRepaint` falso |
| `SprayGlow` | profundidade | `RadialGradient`, nunca `BackdropFilter` (blur custa uma passada de GPU por frame) |
| `BrushRule` | separação | só entre **seções**, nunca entre itens de lista |
| `StickerTag` | destaque | **no máximo um por composição** |
| `ScribbleMark` | personalidade | **no máximo um por tela**, sempre apontando pra algo real |

Todos são determinísticos (mesma semente → mesmo desenho), então nada "pisca"
ao rolar a tela.

---

## 6. Componentes — `lib/widgets/`

| Componente | Onde | Variantes |
|---|---|---|
| `VibesterButton` | `buttons/` | `primary` `accent` `outline` `ghost` × `idle` `loading` `success` `error` |
| `VibesterTag` | `common/` | `onPhoto` `outline` `brand` `live` |
| `VibesterChip` / `VibesterChipRail` | `common/` | filtro selecionável |
| `VibesterImage` | `common/` | rede, arquivo, asset — com esqueleto e placeholder próprios |
| `VibesterSkeleton` / `VibesterSkeletonLines` | `common/` | carregamento |
| `VibesterState` / `.error` | `common/` | vazio e erro |
| `SectionHeader` | `common/` | abertura editorial numerada |
| `ScreenHeader` | `common/` | topo de tela secundária (substitui `AppBar`) |
| `VibesterSearchField` | `common/` | busca |
| `PrimaryTextField` | `text-field/` | campo de formulário |
| `SettingsRow` / `SettingsGroupLabel` | `common/` | telas de ajuste |
| `EventPosterCard` | `cards/event/` | `hero` `compact` `wide` |
| `PlaceTile` | `cards/place/` | `rail` `row` |
| `PublicationCard` | `cards/feed/` | post do feed |
| `AppCamera` | `media/camera/` | câmera do app: preview, flash, lente, zoom, foco e todos os estados (sempre no tema escuro) |
| `MediaPreview` | `media/` | revisão da foto antes de usar (câmera e galeria) |
| `showMediaSourceSheet` | `media/` | escolha câmera × galeria |
| `ShutterButton` / `MediaRoundButton` | `media/` | obturador e botões redondos sobre foto |
| `VibesterNavbar` | `navigation/` | navegação principal — ver §10 |

Legado mantido como fachada fina sobre `VibesterButton`: `PrimaryButton`,
`SecundaryButton`, `TertiaryButton`. **Em tela nova, use `VibesterButton`.**

---

## 7. Movimento — `lib/theme/app_motion.dart`

Já existia e continua valendo. Hierarquia por peso da interação:

```text
micro  140ms  → botão, ícone, toggle
ui     280ms  → card, navegação, sheet, filtro
expressive 550ms → onboarding, hero, celebração
```

Entrada (350ms) mais expressiva que saída (180ms). Springs reais
(`springPress`, `springBouncy`, `springSmooth`) para toque, entrada e o
indicador do dock. Transições de rota em `theme/vibester_page_route.dart`:
`vibesterSlideRoute` (tela secundária), `vibesterFadeRoute` (contexto amplo),
`vibesterDetailRoute` (detalhe, acompanhado de `Hero`).

Toda animação respeita "reduzir movimento" do sistema via
`context.adaptiveMotion(...)` / `context.reduceMotion`.

**Regra:** animação que não cumpre feedback, hierarquia, navegação,
continuidade, descoberta ou personalidade — sai. Sem loops infinitos de fundo.

---

## 8. Não fazer

- Trocar a paleta ou hardcodar hex novo.
- DM Mono em texto longo; uppercase em tudo.
- Sticker ou rabisco sem função.
- Card dentro de card dentro de card.
- Largura fixa em pixel (ex.: `SizedBox(width: 350)`) — quebra em tela estreita.
- `BackdropFilter`/blur em lista rolável.
- Alvo de toque menor que 44px.
- Estado comunicado **só** por cor.
- `Colors.white` sobre preenchimento de marca — use `onFill`/`onAmbar`/`onBrasa`.
- `late final` com inicialização na declaração para `AnimationController`/
  `TabController` usados só em alguns caminhos de build: se o build nunca tocar
  no campo, o `dispose()` acaba criando o Ticker sobre uma árvore já
  desativada. Inicialize no `initState`.
- **Dado inventado**: contador, avaliação, oferta, seguidor ou review que a API
  não devolveu. Se não há dado, a seção não aparece.

---

## 9. Testes

`flutter test` cobre o sistema em quatro frentes (133 testes):

| Arquivo | O que garante |
|---|---|
| `test/theme/palette_test.dart` | os seis tokens de marca não mudaram de valor, e o tema expõe Outfit + `AppColors` |
| `test/utils/event_time_test.dart` | a leitura temporal do evento (é hoje? já começou? falta quanto?) e a formatação de distância |
| `test/widgets/components_test.dart` | cada componente do DS: variantes, estados, alvo de toque de 44px, contraste de `onFill` e o texto que acompanha a cor |
| `test/screens/screens_render_test.dart` | **toda** tela do app montada em 320/390/600px e nos dois temas |

A bateria de telas é o QA visual automatizado: em debug, o Flutter reporta
estouro de layout e sliver inválido como erro do framework, e o teste reprova.
Foi ela que pegou, entre outros, o `layoutExtent exceeds paintExtent` da régua
fixa da Home e o crash de `TabController` ao sair do detalhe de um lugar que
falhou ao carregar.

Ao mexer numa tela, rode `flutter analyze && flutter test` — os dois passam
limpos hoje.

---

## 10. Navbar — `lib/widgets/navigation/`

A navegação principal é um objeto de vidro apoiado sobre o app, não uma barra
com cinco ícones. Cinco arquivos, cada um com uma responsabilidade:

| Arquivo | Papel |
|---|---|
| `navbar_tokens.dart` | toda medida e tempo (altura, blur, escalas, durações) |
| `navbar_background.dart` | vidro fosco, contorno, sombra, luz ambiente, grão |
| `navbar_indicator.dart` | halo que viaja entre os destinos |
| `navbar_item.dart` | destino tocável, com press/seleção/entrada |
| `navbar_center_action.dart` | a ação de publicar |
| `vibester_navbar.dart` | orquestra tudo e é o que as telas usam |

**A forma** é uma `StadiumBorder` simples, usada em três lugares ao mesmo
tempo: `ShapeDecoration` desenha a sombra a partir dela, `ShapeBorderClipper`
recorta o vidro nela e o `foregroundDecoration` traça o contorno por cima do
conteúdo.

Houve uma versão com concavidade (`NotchedPillBorder`, um `OutlinedBorder`
sobre o `CircularNotchedRectangle` do Flutter) para o botão central se apoiar
na barra ao modo FAB. Ela saiu junto com a decisão de trazer o botão para
dentro: sem nada apoiado nele, o vale seria um buraco no topo sem função.

**Geometria.** Tudo cabe na altura da barra, inclusive a ação central — ela
ocupa um vão (`centerSlot`) no meio da fileira, como um item. Além de ser a
composição escolhida, isso elimina a possibilidade de parte do botão ficar
visível fora do pai e parar de receber toque, defeito silencioso do padrão
sobreposto. Os slots saem da largura disponível menos o vão central e menos
`contentInset` de cada lado — sem esse recuo, o destaque do primeiro e do
último destino bate na curva da pill e é cortado, virando um retângulo de
aresta viva.

**Destaque do item ativo.** Uma cápsula em `ambar` translúcido que desliza
por baixo do ícone — cor de fundo e nada mais. Houve também um halo radial e
um traço de marcador viajando junto; os dois saíram a pedido, e a barra ficou
mais calma por isso: ela já tem vidro, grão e um botão luminoso no meio.

**Motion.** Um `AnimationController` orquestra a entrada em faixas
sobrepostas (barra → ícones escalonados → luz → ação central com overshoot);
o destaque viaja com `SpringSimulation`; cada item tem mola no toque e um
pulso curto ao *virar* ativo — nunca um pulso contínuo. Tudo respeita
"reduzir movimento".

**Custo.** Um `BackdropFilter` no app inteiro, aqui, com `RepaintBoundary` em
volta: a navbar fica sobre listas que rolam e o filtro repinta a cada frame de
scroll. Empilhar um segundo pagaria a conta duas vezes por frame. A luz
ambiente é gradiente, não blur, pela mesma razão.

**Acessibilidade.** Cada destino tem `Semantics(button, selected, label)`, o
rótulo visível do ativo é `ExcludeSemantics` (senão o leitor lê "FEED, FEED"),
os alvos passam de 44px e o rótulo tem teto de escala de texto para não
estourar a barra.
