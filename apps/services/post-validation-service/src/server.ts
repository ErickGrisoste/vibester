import { env } from "./config/env";
import { startApi } from "./api";
import { startWorker } from "./worker";

/**
 * Entrypoint único. A mesma imagem roda nos dois modos, selecionados por
 * `SERVICE_MODE`, e sobem como dois Deployments no k8s.
 */
async function main() {
    if (env.mode === "worker") {
        await startWorker();
        return;
    }

    await startApi();
}

main().catch((error) => {
    console.error("[BOOT] Falha ao iniciar o post-validation-service", error);
    process.exit(1);
});
