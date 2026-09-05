# Mídias no post — como consumir (foto e vídeo)

> Guia para o cliente (app Flutter) publicar posts com múltiplas imagens e
> vídeos e ler essa mídia de volta no feed.
>
> Cobre `post-service` (publicação e leitura por usuário/estabelecimento) e
> `feed-service` (timeline). O código-fonte é a fonte de verdade.

---

## O que mudou

Antes, o post trafegava a mídia como `imageUrls: string[]` do upload até o
feed. Não havia nada distinguindo foto de vídeo, então o app não tinha como
saber, item a item, se devia renderizar uma imagem ou um player.

Agora toda mídia carrega o tipo junto:

```
["url1", "url2"]  →  [{ url, type }, { url, type }]
```

A **ordem da lista é a ordem do carrossel** — o backend preserva exatamente a
ordem enviada, tanto na gravação quanto na leitura.

---

## Fluxo completo

Publicar um post com mídia tem três etapas:

```
1. POST /posts/upload-url   → pede uma URL assinada por arquivo
2. PUT <uploadUrl>          → sobe cada arquivo direto no R2 (não passa pela API)
3. POST /posts              → cria o post com a lista final de mídia
```

O passo 2 vai direto para o Cloudflare R2, sem passar pelo backend. O passo 1
existe só para o backend assinar essa permissão de escrita.

---

## Passo 1 — `POST /posts/upload-url`

Pede uma URL de upload por arquivo. **Informe o content-type real de cada
um**: a URL é assinada com ele, e o upload falha se o `PUT` mandar outro.

**Request**

```json
{
  "userId": "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
  "files": [
    { "type": "IMAGE", "contentType": "image/jpeg" },
    { "type": "VIDEO", "contentType": "video/mp4" },
    { "type": "IMAGE", "contentType": "image/jpeg" }
  ]
}
```

**Response `200`** — mesma ordem do request:

```json
[
  {
    "uploadUrl": "https://....r2.cloudflarestorage.com/posts/<userId>/<uuid>.jpg?X-Amz-Signature=...",
    "key": "posts/<userId>/<uuid>.jpg",
    "publicUrl": "https://<bucket-publico>/posts/<userId>/<uuid>.jpg",
    "type": "IMAGE",
    "contentType": "image/jpeg"
  }
]
```

- `uploadUrl` — destino do `PUT`. **Expira em 5 minutos.**
- `publicUrl` — é esta que vai no `POST /posts`, não a `uploadUrl`.

**Content-types aceitos**

| `type`  | `contentType`                                         |
|---------|-------------------------------------------------------|
| `IMAGE` | `image/jpeg`, `image/png`, `image/webp`, `image/heic`  |
| `VIDEO` | `video/mp4`, `video/quicktime`, `video/webm`          |

Qualquer outro valor devolve `400`. O `contentType` também precisa bater com o
`type`: `{ "type": "IMAGE", "contentType": "video/mp4" }` é rejeitado.

**Limite:** 1 a 10 arquivos por chamada.

---

## Passo 2 — `PUT` no R2

Para cada item, suba o arquivo na `uploadUrl`:

```
PUT <uploadUrl>
Content-Type: <o mesmo contentType declarado no passo 1>

<bytes do arquivo>
```

O header `Content-Type` é **obrigatório e precisa ser idêntico** ao declarado.
Ele faz parte da assinatura — se divergir, o R2 responde `403`.

Não mande header de autenticação: a autorização já está na assinatura da URL.

Sugestão de paralelismo: até 3 uploads simultâneos. Acima disso, em rede móvel
ruim, a taxa por arquivo cai e o tempo total não melhora.

---

## Passo 3 — `POST /posts`

Depois que **todos** os uploads terminarem, cria o post com as `publicUrl` na
ordem escolhida pelo usuário.

**Request**

```json
{
  "userId": "a1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
  "caption": "noite boa",
  "media": [
    { "url": "https://<bucket>/posts/<userId>/a.jpg", "type": "IMAGE" },
    {
      "url": "https://<bucket>/posts/<userId>/b.mp4",
      "type": "VIDEO",
      "thumbnailUrl": "https://<bucket>/posts/<userId>/b-capa.jpg"
    },
    { "url": "https://<bucket>/posts/<userId>/c.jpg", "type": "IMAGE" }
  ],
  "userUsername": "fulano",
  "userProfilePicture": "https://...",
  "userVerified": false,
  "establishmentId": "c1b2c3d4-e5f6-4a7b-8c9d-e0f1a2b3c4d5",
  "establishmentName": "Bar do Ze",
  "establishmentLogo": "https://...",
  "establishmentCategory": "bar",
  "tags": ["rock", "sexta"]
}
```

Obrigatórios: `userId` e `media` (ou `imageUrls`, ver [Legado](#legado)).
Todo o resto é opcional.

**Validações** — todas devolvem `400`:

| Regra | Detalhe |
|---|---|
| `media` não vazia | post sem mídia é rejeitado |
| Máximo 10 itens | por post |
| `type` é `IMAGE` ou `VIDEO` | qualquer outro valor é rejeitado |
| `url` pertence ao bucket | link externo não é aceito como mídia do post |
| `thumbnailUrl` idem | também precisa ser do bucket |
| `caption` até 2000 caracteres | opcional |

Corpo do erro:

```json
{
  "message": "Validation error",
  "errors": [
    { "field": "media.0.url", "message": "URL não pertence ao bucket de mídia" }
  ]
}
```

**Response `201`** — o post criado, já no formato de leitura descrito abaixo.

---

## Leitura

`media` aparece igual em todas as rotas de leitura:

- `GET /posts/:postId`
- `GET /users/:userId/posts`
- `GET /establishments/:establishmentId/posts`
- `GET /feed/:userId` (feed-service)

```json
{
  "postId": "...",
  "caption": "noite boa",
  "media": [
    { "url": "https://<bucket>/a.jpg", "type": "IMAGE" },
    {
      "url": "https://<bucket>/b.mp4",
      "type": "VIDEO",
      "thumbnailUrl": "https://<bucket>/b-capa.jpg"
    }
  ],
  "imageUrls": ["https://<bucket>/a.jpg"]
}
```

Renderize a partir de **`media`**, item a item: `IMAGE` vira imagem, `VIDEO`
vira player (usando `thumbnailUrl` como capa enquanto não dá play).

`thumbnailUrl` é opcional e só aparece em itens `VIDEO`. Quando ausente, gere
a capa localmente ou mostre o primeiro frame.

> **Atenção ao feed:** os demais campos de `GET /feed/:userId` são
> `snake_case` (`image_urls`, `created_at`, `item_type`). Só `media` é
> `camelCase`, para ficar idêntico ao do post-service. Não é engano.

---

## Legado

Durante a transição, os dois formatos convivem.

**Na escrita**, `POST /posts` ainda aceita `imageUrls: string[]` e converte
cada item para `{ url, type: "IMAGE" }`. `POST /posts/upload-url` ainda aceita
`count: N` e trata todos como `image/jpeg`. As duas formas são **legado** —
não use em código novo, e não misture `media` com `imageUrls` na mesma
requisição.

**Na leitura**, `imageUrls` continua sendo devolvido, contendo **apenas os
itens `IMAGE`** de `media`, na ordem original. Um post só de vídeo devolve
`imageUrls: []`. Uma versão do app que só lê `imageUrls` continua funcionando,
mas não enxerga os vídeos — por isso a migração do cliente para `media` é o
que destrava o recurso.

Posts criados antes desta mudança não têm `media` gravada no banco; nesses, a
lista é derivada de `image_urls` na leitura, com todo item como `IMAGE`. Do
ponto de vista do app o formato é o mesmo — não há caso especial a tratar.

---

## Compressão antes do upload

O backend **não** recomprime o que chega pela URL assinada — o arquivo vai
para o bucket como o app mandou, e é esse arquivo que os outros usuários
baixam. Comprimir no dispositivo antes do `PUT` não é otimização opcional: é
o que define o peso do feed para todo mundo.

Referência: limitar imagem a 1920px na maior dimensão, e vídeo a 1080p com
bitrate controlado.

---

## Erros comuns

| Sintoma | Causa provável |
|---|---|
| `403` do R2 no `PUT` | `Content-Type` do `PUT` diferente do `contentType` declarado no passo 1 |
| `403` do R2 no `PUT` | `uploadUrl` expirada (5 min) — peça outra |
| `400` "URL não pertence ao bucket de mídia" | mandou a `uploadUrl` no lugar da `publicUrl` |
| `400` em `contentType` | tipo fora da lista, ou `type` e `contentType` incompatíveis |
| Vídeo some do carrossel | app lendo `imageUrls` em vez de `media` |
| Post duplicado | falta trava no botão publicar entre o toque e a resposta do `POST /posts` |

---

## Checklist de integração

- [ ] Passo 1 manda `files` com o content-type real de cada arquivo, não `count`
- [ ] `PUT` manda o header `Content-Type` idêntico ao declarado
- [ ] Passo 3 usa `publicUrl`, nunca `uploadUrl`
- [ ] A ordem da lista é a ordem escolhida pelo usuário no carrossel
- [ ] Vídeo sobe com `thumbnailUrl` (capa gerada no dispositivo)
- [ ] Leitura renderiza a partir de `media`, não de `imageUrls`
- [ ] Compressão de imagem e vídeo acontece antes do `PUT`
- [ ] Botão publicar trava do toque até a resposta do `POST /posts`
