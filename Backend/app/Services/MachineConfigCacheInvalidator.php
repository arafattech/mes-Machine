<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Invalidates the Redis cache the Node server keeps for machine polling
 * config (`machine:channel_configs` / `machine:runtime_configs`, built from
 * machine_has_configs/machine_signals/machine_transport_configs/config_has_channels).
 * That cache is otherwise TTL-only; deleting both keys on write lets Node
 * pick up config changes on its next poll tick instead of waiting out the TTL.
 *
 * Uses the 'shared_cache' Redis connection (config/database.php), which is
 * intentionally unprefixed so it targets the exact keys Node's ioredis
 * client reads/writes — the default connection's "laravel_database_" prefix
 * would silently operate on different keys.
 */
class MachineConfigCacheInvalidator
{
    private const CACHE_KEYS = [
        'machine:channel_configs',
        'machine:runtime_configs',
    ];

    /**
     * Delete both cache keys. Failures are logged, never thrown — a cache
     * invalidation miss just falls back to the existing TTL, and must never
     * fail the config save that triggered it.
     */
    public function invalidate(): void
    {
        try {
            Redis::connection('shared_cache')->del(...self::CACHE_KEYS);
        } catch (Throwable $e) {
            Log::warning('Failed to invalidate machine config cache in Redis.', [
                'keys' => self::CACHE_KEYS,
                'exception' => $e->getMessage(),
            ]);
        }
    }
}
