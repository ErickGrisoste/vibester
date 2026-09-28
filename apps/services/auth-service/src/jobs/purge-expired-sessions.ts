import prismaClient, { pool } from "../prisma/index";

/**
 * Apaga sessões vencidas (quem ficou mais de REFRESH_TOKEN_TTL_SECONDS sem
 * abrir o app). Roda como CronJob do k8s (`k8s/cronjob-purge-sessions.yaml`),
 * fora das réplicas do serviço, para não repetir o trabalho em cada pod.
 *
 * Apaga em lotes para não segurar lock numa faixa grande da tabela nem gerar
 * uma transação gigante; o índice em `expiresAt` sustenta o subselect.
 */
const BATCH_SIZE = 5_000;

export async function purgeExpiredSessions(): Promise<number> {
    let total = 0;

    for (;;) {
        const deleted = await prismaClient.$executeRaw`
            DELETE FROM "sessions"
            WHERE "id" IN (
                SELECT "id" FROM "sessions"
                WHERE "expiresAt" < NOW()
                LIMIT ${BATCH_SIZE}
            )`;

        total += deleted;
        if (deleted < BATCH_SIZE) return total;
    }
}

if (require.main === module) {
    purgeExpiredSessions()
        .then((total) => {
            console.log(JSON.stringify({ event: "auth.sessions.purged", total }));
        })
        .catch((err) => {
            console.error(err);
            process.exitCode = 1;
        })
        .finally(() => pool.end());
}
