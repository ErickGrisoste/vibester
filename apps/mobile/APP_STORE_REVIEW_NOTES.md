# Vibester — App Review Notes

> Texto para **App Store Connect → App Review Information → Notes**.
> Tudo o que está descrito abaixo existe na build (ver `APP_STORE_AUDIT.md`).
> Antes de enviar: criar as duas contas de teste e preencher `<...>`.

---

## Preparar antes do envio

1. Criar **conta A** (a do reviewer) e **conta B** (conteúdo de terceiro), ambas com data de nascimento de adulto.
2. Na conta B: publicar 2 posts com foto e 1 com vídeo; seguir a conta A.
3. Na conta A: seguir a conta B, publicar 1 post, fazer 1 check-in.
4. Confirmar que o post da conta B aparece no FEED da conta A.
5. Confirmar que o e-mail de contato@vibester.com.br recebe a denúncia de teste.
6. Não usar a conta A para testar exclusão antes do envio. Para demonstrar a exclusão, o reviewer pode criar uma conta nova ou excluir a conta A. Se a conta A for excluída durante a análise, recriar antes de uma nova submissão.

---

## ENGLISH VERSION (colar no App Store Connect)

```text
Vibester helps adults (18+) in Brazil discover what is happening in their
city tonight: events, bars and clubs nearby, and photo/video posts from people
who are there. The app is in Brazilian Portuguese.

TEST ACCOUNT
Email: <conta A>
Password: <senha A>
(Sign-up requires a 6-digit code sent by email, so this account is already
verified. Sessions expire after 1 hour; the app then shows "Sua sessão
expirou" and returns to login.)

HOW TO TEST
1. Launch the app, tap "Já tenho conta" and sign in.
2. FEED tab: posts from accounts you follow.
3. EXPLORAR tab: search places, events and people.
4. (+) button: create a post with photos/videos from the library or camera.
5. HOJE tab: events now/today/this week and places nearby. Location is
   optional; if denied, the app keeps working without the "near you" section.
6. VOCÊ tab: your profile. The gear icon opens Settings ("Ajustes").

USER-GENERATED CONTENT SAFEGUARDS (Guideline 1.2)
- Terms of Use: users must tick "Tenho 18 anos ou mais e aceito os Termos de
  Uso e a Política de Privacidade" to sign up. The Terms state zero tolerance
  for objectionable content and abusive users.
- Report a post: in FEED, tap "⋯" on a post by another user → "Denunciar
  publicação" → choose a reason → "Enviar denúncia".
- Report a user: open another user's profile → "⋯" (top right) →
  "Denunciar perfil".
- Block a user: "⋯" on a post or profile → "Bloquear perfil". The users stop
  following each other, the blocked user's posts disappear from the feed and
  they cannot follow again. Undo in Ajustes → "Contas bloqueadas".
- Moderation: every report is stored and immediately emailed to our
  moderation inbox. We review reports within 24 hours, remove violating
  content and suspend the offending account (suspended accounts cannot sign
  in).
- Contact: Ajustes → "Ajuda e contato" (contato@vibester.com.br).

ACCOUNT DELETION (Guideline 5.1.1(v))
Ajustes → "Excluir conta" (below "Sair da conta") → enter password →
"Excluir minha conta" → confirm. The account and its profile, posts, photos,
videos, likes, comments, follows, blocks, reports and notifications are
permanently deleted, and the app returns to the welcome screen.

PASSWORD RECOVERY
Login → "ESQUECI MINHA SENHA" → email → 6-digit code sent by email → new
password.

PERMISSIONS
- Camera / Microphone: only when the user opens the in-app camera to
  capture a photo or video.
- Photos: to pick media for posts and the profile picture, and to save a
  copy of captures to a "Vibester" album.
- Location (When In Use only): to list places nearby. Optional.
The app has no ads, no tracking and no third-party analytics SDKs.

PAYMENTS
This version has no in-app purchases or paid features. "Garantir ingresso"
on an event opens the organizer's website to buy tickets for physical,
real-world events.

LEGAL
Terms of Use: https://vibester.com.br/termos
Privacy Policy: https://vibester.com.br/privacidade
Support: https://vibester.com.br/suporte

CONTACT
contato@vibester.com.br
```
