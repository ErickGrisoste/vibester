import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "crypto";
import { getCassandraClient, disconnectCassandra } from "../../src/config/cassandra";
import { InteractionRepository } from "../../src/repository/interaction.repository";
import { NormalizedInteraction } from "../../src/types/interaction.types";
import { toDayBucket } from "../../src/utils/bucket";

/**
 * Testes contra Cassandra REAL (docker-compose.test.yml + npm run migrate).
 *
 * É aqui que as afirmações do design são verificadas de fato: TTL aplicado,
 * idempotência por chave primária e bucket de partição correto. Os testes
 * mockados não provam nada disso.
 *
 * Exige: CASSANDRA_CONTACT_POINTS, ASTRA_KEYSPACE, KAFKA_BROKERS, JWT_SECRET.
 */
const repository = new InteractionRepository();

const OCCURRED_AT = "2026-09-11T23:04:12.512Z";
const DAY_BUCKET = "2026-09-11";

function buildInteraction(overrides: Partial<NormalizedInteraction> = {}): NormalizedInteraction {
    return {
        userId: randomUUID(),
        eventId: randomUUID(),
        type: "IMPRESSION",
        itemId: randomUUID(),
        itemType: "POST",
        occurredAt: OCCURRED_AT,
        sessionId: randomUUID(),
        position: 7,
        dwellMs: 1840,
        source: "FEED",
        ...overrides,
    };
}

describe("InteractionRepository contra Cassandra real", () => {
    beforeAll(async () => {
        await getCassandraClient().connect();
    });

    afterAll(async () => {
        await disconnectCassandra();
    });

    it("persiste um lote e lê de volta pela partição (user_id, day_bucket)", async () => {
        const userId = randomUUID();

        await repository.insertMany([
            buildInteraction({ userId }),
            buildInteraction({ userId, type: "DWELL" }),
            buildInteraction({ userId, type: "SKIP" }),
        ]);

        const result = await repository.findByUserAndDay(userId, DAY_BUCKET);

        expect(result.rows).toHaveLength(3);
        expect(result.rows.map((row) => row.type).sort()).toEqual(["DWELL", "IMPRESSION", "SKIP"]);
    });

    it("aplica TTL em cada linha", async () => {
        const userId = randomUUID();

        await repository.insertMany([buildInteraction({ userId })]);

        const result = await getCassandraClient().execute(
            "SELECT TTL(type) AS ttl_type FROM interactions_by_user WHERE user_id = ? AND day_bucket = ?",
            [userId, DAY_BUCKET],
            { prepare: true }
        );

        const ttl = result.rows[0]!.ttl_type as number;

        // 90 dias por padrão; a asserção é frouxa de propósito para não quebrar se
        // INTERACTION_TTL_DAYS for ajustado — o que importa é que exista TTL.
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(90 * 24 * 60 * 60);
    });

    it("é idempotente: reprocessar o mesmo lote não duplica linha", async () => {
        const userId = randomUUID();
        const batch = [
            buildInteraction({ userId }),
            buildInteraction({ userId, type: "TAP_DETAIL" }),
        ];

        await repository.insertMany(batch);
        await repository.insertMany(batch);
        await repository.insertMany(batch);

        const result = await repository.findByUserAndDay(userId, DAY_BUCKET);

        expect(result.rows).toHaveLength(2);
    });

    it("separa em partições diferentes quando o evento cai em outro dia UTC", async () => {
        const userId = randomUUID();

        await repository.insertMany([
            buildInteraction({ userId, occurredAt: "2026-09-11T23:59:59.000Z" }),
            buildInteraction({ userId, occurredAt: "2026-09-12T00:00:01.000Z" }),
        ]);

        const dia11 = await repository.findByUserAndDay(userId, "2026-09-11");
        const dia12 = await repository.findByUserAndDay(userId, "2026-09-12");

        expect(dia11.rows).toHaveLength(1);
        expect(dia12.rows).toHaveLength(1);
        expect(toDayBucket("2026-09-12T00:00:01.000Z")).toBe("2026-09-12");
    });

    it("escreve um lote maior que o limite de concorrência sem perder evento", async () => {
        const userId = randomUUID();
        const batch = Array.from({ length: 50 }, () => buildInteraction({ userId }));

        await repository.insertMany(batch);

        const result = await repository.findByUserAndDay(userId, DAY_BUCKET, 200);

        expect(result.rows).toHaveLength(50);
    });

    it("guarda null nos campos que o evento de domínio não tem", async () => {
        const userId = randomUUID();

        await repository.insertMany([
            buildInteraction({
                userId,
                type: "LIKE",
                sessionId: null,
                position: null,
                dwellMs: null,
                source: null,
            }),
        ]);

        const result = await repository.findByUserAndDay(userId, DAY_BUCKET);
        const row = result.rows[0]!;

        expect(row.type).toBe("LIKE");
        expect(row.session_id).toBeNull();
        expect(row.feed_position).toBeNull();
        expect(row.dwell_ms).toBeNull();
        expect(row.source).toBeNull();
    });
});
