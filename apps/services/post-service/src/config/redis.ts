import Redis from "ioredis";
import { env } from "./env";
import { cacheResultTotal } from "../metrics/registry";

export const redis = new Redis(env.redis_url, {
    lazyConnect: true,
    maxRetriesPerRequest: 2,
    enableOfflineQueue: false,
    connectTimeout: 2000,
});

redis.on("error", (err: Error) => {
    console.error(JSON.stringify({ level: "error", service: "redis", msg: err.message }));
});

// `post:id:<uuid>` -> `post:id`, `post:user:<uuid>:50` -> `post:user` — os dois
// primeiros segmentos já identificam o padrão de leitura, sem cardinalidade de
// UUID/limit/cursor na métrica.
function keyPrefix(key: string): string {
    return key.split(":").slice(0, 2).join(":");
}

export async function cacheAside<T>(
    key: string,
    ttlSeconds: number,
    fetchFn: () => Promise<T>,
): Promise<T> {
    const prefix = keyPrefix(key);

    try {
        const cached = await redis.get(key);
        if (cached !== null) {
            cacheResultTotal.inc({ result: "hit", key_prefix: prefix });
            return JSON.parse(cached) as T;
        }
        cacheResultTotal.inc({ result: "miss", key_prefix: prefix });
    } catch (err) {
        cacheResultTotal.inc({ result: "error", key_prefix: prefix });
        const msg = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ level: "warn", service: "redis", op: "get", key, msg }));
    }

    const data = await fetchFn();

    try {
        await redis.set(key, JSON.stringify(data), "EX", ttlSeconds);
    } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(JSON.stringify({ level: "warn", service: "redis", op: "set", key, msg }));
    }

    return data;
}
