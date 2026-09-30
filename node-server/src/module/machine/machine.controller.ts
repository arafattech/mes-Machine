import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { MachineService } from '@module/machine/machine.service';
import { GetRedisClient } from 'config/redis/config.redis';
import { SyncMachine } from '@module/machine/sync-engine/sync.machine';
@Controller()
export class MachineController {
  constructor(
    private readonly syncMachine: SyncMachine,
    private readonly machineService: MachineService,
  ) {}

  @Get('/machine')
  async getFromRedisRange(
    @Query('machineId') machineId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!machineId) throw new BadRequestException('machineId is required');
    if (!from) throw new BadRequestException('from is required');
    if (!to) throw new BadRequestException('to is required');

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (Number.isNaN(fromDate.getTime())) {
      throw new BadRequestException('Invalid from date. Use ISO string.');
    }
    if (Number.isNaN(toDate.getTime())) {
      throw new BadRequestException('Invalid to date. Use ISO string.');
    }
    if (fromDate.getTime() > toDate.getTime()) {
      throw new BadRequestException('from must be <= to');
    }

    const redis = GetRedisClient();
    const key = `machine:buffer:${machineId}`;
    const items = await redis.zrangebyscore(
      key,
      fromDate.getTime(),
      toDate.getTime(),
    );

    return items.map((x) => JSON.parse(x));
  }

  @Post('/machine_data')
  async createMachineData(@Body() data: any) {
    try {
      await this.syncMachine.socketToRedis(data);
      const machineId = String(data?.machineId ?? '');
      if (machineId) this.machineService.broadcastData(machineId, data);
      return {
        message: 'created successfully',
      };
    } catch (err) {
      throw new BadRequestException(err);
    }
  }
}
