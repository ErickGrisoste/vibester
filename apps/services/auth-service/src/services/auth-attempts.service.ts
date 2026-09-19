import { redis } from "../config/redis";
import { producer } from "../kafka/producer";
import { env } from "../config/env";

const FAIL_KEY = (email: string) => `auth:fail:login:${email}`;

export const EXCESSIVE_ATTEMPTS_TOPIC = "auth.attempts.exceeded";

export class AuthAttemptsService {
    /**
     * Conta uma falha de login e avisa o dono da conta quando o limite da janela
     * é atingido.
     *
     * Só deve ser chamado quando a conta EXISTE e a senha errou. No caminho
     * "conta não encontrada" não há para quem notificar, e disparar email ali
     * transformaria o endpoint em ferramenta de enumeração e de spam contra
     * terceiros — a resposta HTTP continua sendo o mesmo 401 genérico nos dois
     * casos.
     *
     * O contador vive no Redis (e não em memória) porque o serviço roda com
     * várias réplicas: em memória cada pod contaria sua própria fatia.
     *
     * Nunca propaga erro: Redis fora do ar não pode derrubar o login.
     */
    async registerLoginFailure(email: string, name?: string): Promise<void> {
        try {
            const key = FAIL_KEY(email);
            const attempts = await redis.incr(key);

            if (attempts === 1) {
                await redis.expire(key, env.authFailWindowSeconds);
            }

            // Estritamente igual: dispara UMA vez por janela. Com `>=` o usuário
            // receberia um email a cada nova tentativa depois do limite.
            if (attempts === env.authFailNotifyThreshold) {
                await producer.send({
                    topic: EXCESSIVE_ATTEMPTS_TOPIC,
                    messages: [
                        {
                            value: JSON.stringify({
                                email,
                                name,
                                attempts,
                                windowSeconds: env.authFailWindowSeconds,
                                occurredAt: new Date().toISOString(),
                            }),
                        },
                    ],
                });
            }
        } catch {
            /* contador/aviso são best-effort — nunca bloqueiam a autenticação */
        }
    }

    /**
     * Zera o contador após um login bem-sucedido, para que quem errou a senha
     * algumas vezes e entrou não receba um alerta de segurança depois.
     */
    async clearLoginFailures(email: string): Promise<void> {
        try {
            await redis.del(FAIL_KEY(email));
        } catch {
            /* idem */
        }
    }
}
