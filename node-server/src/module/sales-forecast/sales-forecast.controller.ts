import { Body, Controller, Post } from '@nestjs/common';
import {
  SalesForecastService,
  ProductForecastResult,
  DailyOhlcPoint,
} from '@module/sales-forecast/sales-forecast.service';

@Controller()
export class SalesForecastController {
  constructor(private readonly salesForecastService: SalesForecastService) {}

  @Post('run')
  async run(
    @Body() body: { year?: number; month?: number },
  ): Promise<{ data: { products: ProductForecastResult[] } }> {
    const products = await this.salesForecastService.runForecast(body?.year, body?.month);
    return { data: { products } };
  }

  @Post('daily')
  async daily(
    @Body() body: { product_id: number; year: number; month: number },
  ): Promise<{ data: { points: DailyOhlcPoint[] } }> {
    const points = await this.salesForecastService.getDailyOhlc(
      body.product_id,
      body.year,
      body.month,
    );
    return { data: { points } };
  }

  @Post('monthly-ohlc')
  async monthlyOhlc(
    @Body() body: { product_id: number; year?: number; month?: number },
  ): Promise<{ data: { points: DailyOhlcPoint[] } }> {
    const points = await this.salesForecastService.getMonthlyOhlc(
      body.product_id,
      body.year,
      body.month,
    );
    return { data: { points } };
  }
}
