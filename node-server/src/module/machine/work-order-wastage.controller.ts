import { Controller, Get, Param, Query } from '@nestjs/common';
import { WorkOrderWastageService } from '@module/machine/work-order-wastage.service';

@Controller('api/work-orders')
export class WorkOrderWastageController {
  constructor(private readonly workOrderWastageService: WorkOrderWastageService) {}

  @Get(':id/wastage-detail')
  detail(
    @Param('id') id: string,
    @Query('shift_id') shiftId?: string,
    @Query('date') date?: string,
  ) {
    return this.workOrderWastageService.detail(id, shiftId, date);
  }
}
