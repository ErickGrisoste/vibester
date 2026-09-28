import { insertNotification } from "../../services/insertNotification.service";
import { unwrapEventData } from "../envelope";

interface ValidationIssue {
  code: string;
  field: string;
}

interface PostValidationRejectedEvent {
  postId: string;
  authorId: string;
  issues: ValidationIssue[];
  validatedAt: string;
}

/**
 * Mensagem por motivo. O evento carrega só o código — o post-validation-service
 * nunca manda o termo ou o domínio que casou, para não transformar a
 * notificação num oráculo da blocklist. Aqui o código vira texto para o usuário.
 */
const MESSAGE_BY_CODE: Record<string, string> = {
  CONTENT_EMPTY: "a publicação está sem texto e sem mídia",
  CONTENT_TOO_LONG: "o texto excede o limite de caracteres",
  FORBIDDEN_LANGUAGE: "o texto contém linguagem imprópria",
  HATE_SPEECH: "o conteúdo viola as diretrizes da comunidade",
  MALFORMED_LINK: "há um link em formato inválido",
  BLOCKED_LINK: "há um link que não pode ser compartilhado",
  SHORTENED_LINK: "links encurtados não são permitidos",
  TOO_MANY_LINKS: "há links demais na publicação",
  SPAM_SUSPECTED: "a publicação foi identificada como spam",
  TOO_MANY_TAGS: "há tags demais na publicação",
};

/**
 * Avisa o autor quando a revalidação assíncrona reprova um post que já está no
 * ar (`post-validation-service`, modo worker).
 *
 * `actorId` é o próprio autor porque não existe outro ator: quem reprovou foi o
 * sistema, e o schema de `Notification` exige o campo. O efeito no app é a
 * notificação aparecer sem "fulano fez X", que é o correto para um aviso do
 * sistema.
 *
 * O evento pode chegar duplicado — o worker republica quando o Kafka reentrega
 * a mensagem de origem. Isso é assumido no contrato do produtor, e o custo aqui
 * é uma notificação repetida, não um estado inconsistente.
 */
export async function handlePostValidationRejectedEvent(value: string): Promise<void> {
  try {
    const event = unwrapEventData<PostValidationRejectedEvent>(JSON.parse(value));

    if (!event.postId || !event.authorId) return;

    const reasons = (event.issues ?? [])
      .map((issue) => MESSAGE_BY_CODE[issue.code])
      .filter((reason): reason is string => Boolean(reason));

    // O texto NÃO pode dizer que o post foi ocultado: a revalidação só avisa,
    // o post continua no ar até alguém decidir o contrário (ver "Enforcement"
    // no CLAUDE.md do post-validation-service). E a única ação disponível ao
    // autor no app hoje é excluir — não há edição de legenda —, então é essa a
    // instrução que vai junto.
    const motivo = reasons.length > 0 ? `: ${reasons.join("; ")}` : "";
    const content =
      `Sua publicação não segue as diretrizes da comunidade${motivo}. ` +
      "Você pode excluí-la pelo menu da publicação.";

    await insertNotification(
      "post_rejected",
      event.authorId,
      event.authorId,
      event.postId,
      content,
    );

    console.log(`[Kafka] Validation rejection notified for post ${event.postId}`);
  } catch (err) {
    console.error("[Kafka] Error handling post.validation.rejected event:", err);
  }
}
