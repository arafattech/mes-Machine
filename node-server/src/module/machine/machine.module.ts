import { Module } from '@nestjs/common';
import { MachineController } from '@module/machine/machine.controller';
import { MachineService } from '@module/machine/machine.service';
import { SyncMachine } from '@module/machine/sync-engine/sync.machine';
import { PrismaService } from '@prisma/prisma.service';
import { MachineConfigService } from '@module/machine/runtime/machine-config.service';
import { MachineRuntimeService } from '@module/machine/runtime/machine-runtime.service';
import { ChannelMappingService } from '@module/machine/runtime/channel-mapping.service';
import { MqttChannelSource } from '@module/machine/runtime/mqtt-channel-source';
import { MachineStateTrackerService } from '@module/machine/runtime/machine-state-tracker.service';
import { MaintenanceOverrideService } from '@module/machine/runtime/maintenance-override.service';

@Module({
  controllers: [MachineController],
  providers: [
    MachineService,
    SyncMachine,
    PrismaService,
    MachineConfigService,
    MachineRuntimeService,
    MqttChannelSource,
    ChannelMappingService,
    MachineStateTrackerService,
    MaintenanceOverrideService,
  ],
})
export class MachineModule {}
