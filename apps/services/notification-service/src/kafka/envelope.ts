/**
 * O post-service publica `post.liked`/`post.commented` no envelope
 * `{ eventId, eventType, occurredAt, data }` (`publishEvent`). Os handlers liam
 * o payload solto, não achavam `postId` e descartavam toda notificação de like
 * e comentário. Payload solto (formato antigo) continua aceito.
 */
export function unwrapEventData<T>(raw: unknown): T {
  if (
    raw !== null &&
    typeof raw === "object" &&
    "eventType" in raw &&
    "data" in raw &&
    typeof (raw as { data: unknown }).data === "object"
  ) {
    return (raw as { data: T }).data;
  }
  return raw as T;
}
