import { env } from "../config/env";
import { postValidationTotal } from "../metrics/registry";

/**
 * Cliente do `post-validation-service`.
 *
 * É a **única** chamada síncrona que o post-service faz para outro serviço, e
 * ela existe por um motivo que a comunicação por evento não resolve: o autor
 * precisa saber que o texto foi recusado **antes** de o post existir. Um evento
 * só avisaria depois de publicado, quando o conteúdo já está no ar.
 *
 * Todo o resto do desenho abaixo é para que essa exceção não vire um ponto
 * único de falha.
 */

export interface ValidationIssue {
    code: string;
    field: string;
    message: string;
}

export interface ValidationVerdict {
    valid: boolean;
    issues: ValidationIssue[];
}

/**
 * Resultado da consulta, do ponto de vista do post-service:
 *
 * - `checked`: o serviço respondeu; `verdict` vale.
 * - `skipped`: não dava para consultar (modo desligado, sem token). Não é erro.
 * - `unavailable`: o serviço não respondeu a tempo ou respondeu errado.
 */
export type ValidationOutcome =
    | { status: "checked"; verdict: ValidationVerdict }
    | { status: "skipped"; reason: string }
    | { status: "unavailable"; reason: string };

export interface ValidationRequest {
    content: string;
    tags?: string[];
    mediaCount: number;
    postId?: string;
    /**
     * Header `Authorization` da requisição original, repassado como está.
     *
     * O `post-validation-service` exige JWT e tira a identidade do `accountId`
     * do token — repassar é o que faz o log de auditoria de lá registrar o
     * autor de verdade. Funciona porque o app mobile anexa o header em **toda**
     * chamada (interceptor único em `apps/mobile/lib/service/api_client.dart`),
     * inclusive nas do post-service, que não o verifica.
     *
     * Não invente um token de serviço aqui: seria um segundo caminho de
     * autenticação para manter, e faria a auditoria perder de quem é o post.
     */
    authorization?: string;
}

export class ValidationClient {

    /**
     * Consulta o veredito. **Nunca lança** — devolve `unavailable` no lugar.
     *
     * Quem decide o que fazer com indisponibilidade é o `PostService`, não o
     * cliente: a política (deixar passar ou barrar) é regra de negócio, e
     * enterrá-la aqui esconderia a decisão mais importante da integração.
     */
    async validatePost(request: ValidationRequest): Promise<ValidationOutcome> {
        if (env.post_validation_mode === "off") {
            postValidationTotal.inc({ result: "skipped" });
            return { status: "skipped", reason: "mode_off" };
        }

        if (!request.authorization) {
            // Sem token não há como consultar: o endpoint de validação exige
            // JWT. Acontece com chamador que não é o app (painel admin, script).
            postValidationTotal.inc({ result: "skipped" });
            return { status: "skipped", reason: "missing_authorization" };
        }

        // AbortController e não só um timeout de socket: o orçamento tem que
        // cobrir a requisição inteira, senão um serviço que aceita a conexão e
        // trava no meio da resposta segura a criação do post pelo tempo todo.
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), env.post_validation_timeout_ms);

        try {
            const response = await fetch(`${env.post_validation_url}/validations/post`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: request.authorization,
                },
                body: JSON.stringify({
                    content: request.content,
                    tags: request.tags ?? [],
                    mediaCount: request.mediaCount,
                    ...(request.postId ? { postId: request.postId } : {}),
                }),
                signal: controller.signal,
            });

            if (!response.ok) {
                // Inclui o 401 de token expirado. Tratar como indisponível, e
                // não como "reprovado", é deliberado: um token vencido é
                // problema de sessão, e transformá-lo em recusa de conteúdo
                // daria ao autor uma mensagem sobre o texto dele que não tem
                // nada a ver com o que aconteceu.
                postValidationTotal.inc({ result: "unavailable" });
                return { status: "unavailable", reason: `http_${response.status}` };
            }

            const verdict = (await response.json()) as ValidationVerdict;

            if (typeof verdict?.valid !== "boolean") {
                postValidationTotal.inc({ result: "unavailable" });
                return { status: "unavailable", reason: "malformed_response" };
            }

            postValidationTotal.inc({ result: verdict.valid ? "valid" : "invalid" });
            return {
                status: "checked",
                verdict: { valid: verdict.valid, issues: verdict.issues ?? [] },
            };
        } catch (err) {
            const reason = err instanceof Error && err.name === "AbortError" ? "timeout" : "network";
            postValidationTotal.inc({ result: "unavailable" });
            return { status: "unavailable", reason };
        } finally {
            clearTimeout(timer);
        }
    }
}
