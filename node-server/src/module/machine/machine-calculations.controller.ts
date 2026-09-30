import { Controller, Get, Param, Query } from '@nestjs/common';
import { MachineCalculationsService } from '@module/machine/machine-calculations.service';

@Controller('api/machine')
export class MachineCalculationsController {
  constructor(private readonly calculationsService: MachineCalculationsService) {}

  @Get(':id/overview')
  overview(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calculationsService.overview(id, from, to);
  }

  @Get(':id/current-work-order')
  currentWorkOrder(@Param('id') id: string) {
    return this.calculationsService.currentWorkOrder(id);
  }

  @Get(':id/shift-breakdown')
  shiftBreakdown(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calculationsService.shiftBreakdown(id, from, to);
  }

  @Get(':id/daily-production')
  dailyProduction(
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.calculationsService.dailyProduction(id, from, to);
  }
}
