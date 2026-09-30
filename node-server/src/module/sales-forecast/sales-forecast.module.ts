import { Module } from '@nestjs/common';
import { SalesForecastController } from '@module/sales-forecast/sales-forecast.controller';
import { SalesForecastService } from '@module/sales-forecast/sales-forecast.service';
import { PrismaService } from '@prisma/prisma.service';

@Module({
  controllers: [SalesForecastController],
  providers: [SalesForecastService, PrismaService],
})
export class SalesForecastModule {}
