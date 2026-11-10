<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Redis;
use Throwable;

/**
 * Publishes "production data changed" signals to node-server over Redis pub/sub so it can
 * drop its cached machine calculations and push a realtime socket update to the frontend
 * (production counts, wastage, targets, machine configs, work orders → OEE / production /
 * wastage panels).
 *
 * Uses the unprefixed 'shared_cache' connection — same reason as MachineConfigCacheInvalidator:
 * node-server's ioredis client subscribes to the exact channel name.
 */
class ProductionEventPublisher
{
    public const CHANNEL = 'mes:production-events';

    /**
     * @param  list<int>  $machineIds
     * @param  list<int>  $workOrderIds
     */
    public function publish(string $type, array $machineIds, array $workOrderIds): void
    {
        if ($machineIds === [] && $workOrderIds === []) {
            return;
        }

        $payload = json_encode([
            'type' => $type,
            'machine_ids' => array_values(array_unique($machineIds)),
            'work_order_ids' => array_values(array_unique($workOrderIds)),
            'at' => now()->toIso8601String(),
        ]);

        // Never fail the write that triggered it — a missed signal only delays the screen
        // until the next event or the client's reconnect resync.
        try {
            Redis::connection('shared_cache')->publish(self::CHANNEL, $payload);
        } catch (Throwable $e) {
            Log::warning('Failed to publish production event to Redis.', [
                'channel' => self::CHANNEL,
                'type' => $type,
                'exception' => $e->getMessage(),
            ]);
        }
    }
}
