import Redis from "ioredis";
import { env } from "./env";

let _client: Redis | null = null;

function getClient(): Redis {
    if (!_client) {
        _client = new Redis(env.redisUrl, {
            lazyConnect: true,
            maxRetriesPerRequest: 2,
            enableOfflineQueue: false,
            connectTimeout: 2_000,
        });
        _client.on("error", () => {});
    }
    return _client;
}

export const redis = {
    /**
     * Client ioredis cru. Existe para o @fastify/rate-limit, que precisa da
     * instancia real (ele chama comandos que este wrapper nao expoe).
     * Para uso normal prefira os metodos abaixo.
     */
    client: () => getClient(),
    connect: () => getClient().connect(),
    disconnect: () => _client?.quit() ?? Promise.resolve(),
    set: (key: string, value: string, ttlSeconds: number) =>
        getClient().set(key, value, "EX", ttlSeconds),
    get: (key: string) => getClient().get(key),
    del: (key: string) => getClient().del(key),
    incr: (key: string) => getClient().incr(key),
    expire: (key: string, ttlSeconds: number) => getClient().expire(key, ttlSeconds),
    ttl: (key: string) => getClient().ttl(key),
};
