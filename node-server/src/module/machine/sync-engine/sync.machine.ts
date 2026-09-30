import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRedisConnection, GetRedisClient } from 'config/redis/config.redis';

type RedisStreamResponse = [string, [string, string[]][]][];

@Injectable()
export class SyncMachine implements OnModuleInit, OnModuleDestroy {
    private readonly logger = new Logger(SyncMachine.name);
    private readonly redis = GetRedisClient();
    // Dedicated connection for the blocking XREADGROUP read below — kept off the
    // shared singleton so its up-to-2s block per cycle can't front-of-line-block
    // unrelated hot-path GET/SET calls (e.g. MachineConfigService) on that connection.
    private readonly blockingRedis = CreateRedisConnection();
    private readonly syncIntervalMs = Number(process.env.MACHINE_DATA_ACTION_DURATION ?? 10000);

    private timer?: NodeJS.Timeout;

    private readonly streamKey = 'mysql:machine_data';
    private readonly consumerGroupName = 'mysql-sync';
    private readonly consumerName = 'worker-1';

    constructor(private readonly prisma: PrismaService) { }

    async onModuleInit() {
        await this.createRedisStreamGroup();
        this.timer = setInterval(() => void this.syncOnce(), this.syncIntervalMs);
        this.timer.unref();
        void this.syncOnce();
    }

    onModuleDestroy() {
        if (this.timer) clearInterval(this.timer);
        this.blockingRedis.disconnect();
    }

    async socketToRedis(data: any) {
        const machineId = String(data?.machineId ?? '');
        if (!machineId) return;

        const isoTs = String(data?.timestamp ?? new Date().toISOString());
        const tsMs = Number.isFinite(Date.parse(isoTs)) ? Date.parse(isoTs) : Date.now();

        const payload = JSON.stringify({
            machineId,
            status: String(data?.status ?? ''),
            value: String(data?.value ?? ''),
            timestamp: new Date(tsMs).toISOString(),
            created_at: new Date(tsMs).toISOString()
        });

        const bufferKey = `machine:buffer:${machineId}`;
        return this.redis.multi()
            .xadd(
                this.streamKey,
                '*',
                'machineId', machineId,
                'status', String(data?.status ?? ''),
                'value', String(data?.value ?? ''),
                'timestamp', new Date(tsMs).toISOString(),
            )

            .zadd(bufferKey, tsMs, payload)
            .zremrangebyscore(bufferKey, 0, Date.now() - 10 * 60 * 1000)
            .expire(bufferKey, 60 * 15)
            .exec();
    }

    private async syncOnce() {
        let streamReadResult: any = null;
        try {
            streamReadResult = (await (this.blockingRedis as any).xreadgroup(
                'GROUP', this.consumerGroupName, this.consumerName,
                'COUNT', 200,
                'BLOCK', 2000,
                'STREAMS', this.streamKey, '>'
            )) as RedisStreamResponse | null;
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes('NOGROUP')) {
                await this.createRedisStreamGroup();
                return;
            }
            throw error;
        }

        if (!streamReadResult?.length) return;

        const [, streamMessages] = streamReadResult[0];
        if (!streamMessages.length) return;

        const parsedMessages = streamMessages.map(([messageId, fieldValuePairs]) => {
            const fields: Record<string, string> = {};
            for (let index = 0; index < fieldValuePairs.length; index += 2) {
                fields[fieldValuePairs[index]] = fieldValuePairs[index + 1];
            }
            return { messageId, fields };
        });

        const machineIdByCustomId = await this.resolveMachineIds(
            parsedMessages.map(({ fields }) => String(fields?.machineId ?? '')).filter(Boolean),
        );

        const ackIds: string[] = [];
        const sensorRows: Prisma.machine_sensor_dataCreateManyInput[] = [];
        const sensorRowMessageIds: string[] = [];

        for (const { messageId, fields } of parsedMessages) {
            const machineCustomId = String(fields?.machineId ?? '');
            if (!machineCustomId) {
                ackIds.push(messageId);
                continue;
            }

            const machineId = machineIdByCustomId.get(machineCustomId);
            if (!machineId) {
                this.logger.warn(`Machine not found for machineId=${machineCustomId}`);
                ackIds.push(messageId);
                continue;
            }

            const rawTs = String(fields?.timestamp ?? new Date().toISOString());
            const timestamp = Number.isNaN(new Date(rawTs).getTime()) ? new Date() : new Date(rawTs);
            const numValue = Number(fields?.value);
            const temperature = Number.isFinite(numValue)
                ? new Prisma.Decimal(numValue)
                : new Prisma.Decimal(0);

            sensorRows.push({ machine_id: machineId, timestamp, temperature });
            sensorRowMessageIds.push(messageId);
        }

        if (sensorRows.length) {
            try {
                await this.prisma.machine_sensor_data.createMany({ data: sensorRows });
                ackIds.push(...sensorRowMessageIds);
            } catch (error) {
                console.error('Failed to batch-insert machine_sensor_data', sensorRows.length, error);
                // Left unacked — redelivered to this consumer group next cycle.
            }
        }

        if (ackIds.length) {
            await this.redis.xack(this.streamKey, this.consumerGroupName, ...ackIds);
        }

        await this.redis.xtrim(this.streamKey, 'MAXLEN', '~', 5000);
    }

    private async createRedisStreamGroup() {
        try {
            await this.redis.xgroup('CREATE', this.streamKey, this.consumerGroupName, '$', 'MKSTREAM');
            this.logger.log(`Created stream group ${this.consumerGroupName} on ${this.streamKey}`);
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (!message.includes('BUSYGROUP')) {
                throw error;
            }
        }
    }

    /**
     * Resolves every distinct machineId string in one batch cycle to a real
     * `machines.id`, one `findMany` instead of up to 2 `findFirst` queries per
     * message — up to ~600 individual round trips per 10s cycle before this.
     * Same priority as the old per-message lookup: `custom_id` match wins,
     * numeric `id` match is the fallback.
     */
    private async resolveMachineIds(machineCustomIds: string[]): Promise<Map<string, bigint>> {
        const uniqueIds = [...new Set(machineCustomIds)];
        if (!uniqueIds.length) return new Map();

        const numericIds: bigint[] = [];
        for (const id of uniqueIds) {
            try {
                numericIds.push(BigInt(id));
            } catch {
                // not numeric — custom_id-only lookup for this one
            }
        }

        const machines = await this.prisma.machines.findMany({
            where: {
                is_active: true,
                OR: [
                    { custom_id: { in: uniqueIds } },
                    ...(numericIds.length ? [{ id: { in: numericIds } }] : []),
                ],
            },
            select: { id: true, custom_id: true },
        });

        const byCustomId = new Map<string, bigint>();
        const byNumericId = new Map<string, bigint>();
        for (const machine of machines) {
            if (machine.custom_id) byCustomId.set(machine.custom_id, machine.id);
            byNumericId.set(machine.id.toString(), machine.id);
        }

        const resolved = new Map<string, bigint>();
        for (const id of uniqueIds) {
            const machineId = byCustomId.get(id) ?? byNumericId.get(id);
            if (machineId !== undefined) resolved.set(id, machineId);
        }
        return resolved;
    }
}
