<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Signals node-server that a machine is under manual maintenance. node-server
 * (the only writer of `machine_state_events`) checks this Redis Set after its
 * status debounce: a machine in the set is forced to MAINTENANCE regardless of
 * its derived status — unless the real Active channel confirms running again,
 * in which case node-server clears the override (`SREM`) and closes the
 * schedule row `ended_by='auto'`.
 *
 * Uses the 'shared_cache' Redis connection (config/database.php), intentionally
 * unprefixed so it targets the exact keys node-server's ioredis client reads —
 * same pattern as MachineConfigCacheInvalidator. Failures are logged, never
 * thrown: a missed signal just means the override is not forced until retried.
 */
class MachineMaintenanceOverrideSignal
{
    public const OVERRIDES_KEY = 'machine:maintenance_overrides';

    /** Mark a machine as under maintenance. Idempotent. */
    public function activate(int $machineId): void
    {
        try {
            Redis::connection('shared_cache')->sadd(self::OVERRIDES_KEY, (string) $machineId);
        } catch (Throwable $e) {
            Log::warning('Failed to set machine maintenance override in Redis.', [
                'machine_id' => $machineId,
                'exception' => $e->getMessage(),
            ]);
        }
    }

    /** Remove the maintenance override for a machine. Idempotent. */
    public function clear(int $machineId): void
    {
        try {
            Redis::connection('shared_cache')->srem(self::OVERRIDES_KEY, (string) $machineId);
        } catch (Throwable $e) {
            Log::warning('Failed to clear machine maintenance override in Redis.', [
                'machine_id' => $machineId,
                'exception' => $e->getMessage(),
            ]);
        }
    }
}
