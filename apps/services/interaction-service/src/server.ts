import { env } from "./config/env";
import { startApi } from "./api";
import { startWorker } from "./worker";

/**
 * Entrypoint único. A mesma imagem roda em dois modos, selecionados por `MODE`,
 * e sobem como dois Deployments separados no k8s.
 *
 * O motivo de não separar em dois repositórios: responsabilidade única de
 * processo sem duplicar build, dependências e CI. O motivo de não rodar os dois
 * no mesmo processo (como o notification-service faz): API e worker têm gargalos
 * diferentes — a API escala por requisições por segundo, o worker por lag da
 * partição do Kafka. Juntos, um obriga o outro a escalar sem necessidade.
 */
async function main() {
    if (env.mode === "worker") {
        await startWorker();
        return;
    }

    await startApi();
}

main().catch((error) => {
    console.error("[BOOT] Falha ao iniciar o interaction-service", error);
    process.exit(1);
});
