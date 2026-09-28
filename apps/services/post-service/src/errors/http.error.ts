/**
 * `details` é opcional e carrega o corpo estruturado do erro, quando a mensagem
 * sozinha não basta para o cliente agir.
 *
 * Existe por causa da recusa de conteúdo (422 do post-validation-service): o app
 * precisa da lista de motivos para mostrar ao autor o que corrigir, e um
 * `message` em texto corrido obrigaria a fazer parse de string. Todo erro que já
 * existia continua sem `details`, e o handler só inclui o campo quando ele está
 * presente — nenhuma resposta atual muda de forma.
 */
export class HttpError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "HttpError";
  }
}
