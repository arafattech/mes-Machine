import { Module } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { MachineCalculationsController } from '@module/machine/machine-calculations.controller';
import { MachineCalculationsService } from '@module/machine/machine-calculations.service';
import { WorkOrderDetailController } from '@module/machine/work-order-detail.controller';
import { WorkOrderDetailService } from '@module/machine/work-order-detail.service';
import { WorkOrderWastageController } from '@module/machine/work-order-wastage.controller';
import { WorkOrderWastageService } from '@module/machine/work-order-wastage.service';
import { MachineConfigService } from '@module/machine/runtime/machine-config.service';

/**
 * Read-heavy calculation endpoints for the Angular machine-overview page.
 * Imported directly in `AppModule` (not nested under the `api` `RouterModule`
 * tree `MachineModule` already sits in) so each controller's own explicit
 * `@Controller('api/...')` prefix is the only prefix applied — nesting this
 * module under that tree too would double it (`/api/machine/api/machine/...`).
 *
 * `MachineConfigService` is provided directly here (not by importing the whole
 * `MachineModule`) so both calculation services can reuse its already-cached
 * `machine:states_map` Redis key instead of querying `machine_states` fresh on
 * every request — it only depends on `PrismaService`, already provided below,
 * so no further wiring is needed.
 */
@Module({
  controllers: [MachineCalculationsController, WorkOrderDetailController, WorkOrderWastageController],
  providers: [PrismaService, MachineCalculationsService, WorkOrderDetailService, WorkOrderWastageService, MachineConfigService],
})
export class CalculationsModule {}
