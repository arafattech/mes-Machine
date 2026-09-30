import Redis from "ioredis";

let redisClient: Redis | null = null;

function createRedisConnection(): Redis {
    return process.env.REDIS_URL ? new Redis(process.env.REDIS_URL) : new Redis();
}

export function GetRedisClient() {
    if (!redisClient) {
        redisClient = createRedisConnection();
    }
    return redisClient;
}

/**
 * A fresh, independent connection (not the shared singleton) — for callers
 * that issue a long blocking command (e.g. `XREADGROUP ... BLOCK`) and would
 * otherwise front-of-line-block every other command sharing that connection
 * for the duration of the block.
 */
export function CreateRedisConnection(): Redis {
    return createRedisConnection();
}

export async function RemoveRedisCache(entity: string, isOdata = true) {
    const redis = GetRedisClient();
    const keys = await redis.keys(isOdata ? `odata:${entity}:*` : entity);
    if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`Deleted ${keys.length} cache keys for entity ${entity}`);
    }
}


export async function CreateRedisCache(cacheKey: string, data: any) {
    const redis = GetRedisClient();
    if (process.env.USE_REDIS_CACHE) {
        await redis.set(cacheKey, JSON.stringify(data), 'EX', Number(process.env.ODATA_CACHE_DURATION ?? 120));

    }
}


export async function GetRedisCache(cacheKey: string) {
    let data: any;
    const redis = GetRedisClient();
    if (process.env.USE_REDIS_CACHE == 'true') {
        const cached = process.env.USE_REDIS_CACHE == 'true' ? await redis.get(cacheKey) : null;
        if (cached && JSON.parse(cached).value !== null) {
            data = JSON.parse(cached);
        }
    }

    return data ?? null;
}

/**
 * Cache-aside with a caller-supplied TTL, unconditional (not gated by
 * `USE_REDIS_CACHE`/`ODATA_CACHE_DURATION` — those are the OData-resource-cache
 * knobs; this is for short-TTL read-heavy endpoint caching). A Redis read/write
 * failure never blocks the request — falls through to `compute()` either way,
 * only the caching itself is skipped.
 */
export async function CacheAside<T>(
    redis: Redis,
    cacheKey: string,
    ttlMs: number,
    compute: () => Promise<T>,
    onError?: (stage: 'read' | 'write', error: unknown) => void,
): Promise<T> {
    try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached) as T;
    } catch (error) {
        onError?.('read', error);
    }

    const result = await compute();

    try {
        await redis.set(cacheKey, JSON.stringify(result), 'PX', ttlMs);
    } catch (error) {
        onError?.('write', error);
    }

    return result;
}

