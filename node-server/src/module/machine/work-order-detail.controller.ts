import { Controller, Get, Param } from '@nestjs/common';
import { WorkOrderDetailService } from '@module/machine/work-order-detail.service';

@Controller('api/work-orders')
export class WorkOrderDetailController {
  constructor(private readonly workOrderDetailService: WorkOrderDetailService) {}

  @Get(':id/detail')
  detail(@Param('id') id: string) {
    return this.workOrderDetailService.detail(id);
  }
}
