import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '@prisma/prisma.service';
import { GetRedisClient } from 'config/redis/config.redis';

const HISTORY_MONTHS = 24;
const FORECAST_CACHE_TTL_MS = Number(process.env.SALES_FORECAST_CACHE_TTL_MS ?? 15 * 60 * 1000);
const OHLC_CACHE_TTL_MS = Number(process.env.SALES_FORECAST_OHLC_CACHE_TTL_MS ?? 15 * 60 * 1000);

interface MonthlySalesRow {
  product_id: bigint;
  product_name: string;
  month: Date;
  qty: bigint | number;
}

export interface ProductForecastResult {
  product_id: number;
  product_name: string;
  history: { date: string; qty: number }[];
  forecast: { date: string; qty: number }[];
  predicted_change_percent: number;
  risk: 'high' | 'medium' | 'low';
}

export interface DailyOhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

interface DailyOrderRow {
  day: Date;
  quantity: number;
  order_id: bigint;
  created_at: Date;
}

interface MonthlyOrderRow {
  month: Date;
  quantity: number;
  order_id: bigint;
  created_at: Date;
}

@Injectable()
export class SalesForecastService {
  private readonly logger = new Logger(SalesForecastService.name);

  constructor(private readonly prisma: PrismaService) {}

  // A month whose data is still being written (the current month) can legitimately
  // return an empty result the moment a request races ahead of the underlying sales
  // data — caching that empty result would keep serving it for the full TTL even
  // after the data shows up. Only cache non-empty results so a stale empty array
  // never sticks; the next request just recomputes instead of trusting a poisoned cache.
  private async cacheAsideSkipEmpty<T extends unknown[]>(
    cacheKey: string,
    ttlMs: number,
    compute: () => Promise<T>,
  ): Promise<T> {
    const redis = GetRedisClient();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached) as T;
    } catch (error) {
      this.logger.warn(`Redis read failed for ${cacheKey}`, error as Error);
    }

    const result = await compute();

    if (result.length > 0) {
      try {
        await redis.set(cacheKey, JSON.stringify(result), 'PX', ttlMs);
      } catch (error) {
        this.logger.warn(`Redis write failed for ${cacheKey}`, error as Error);
      }
    }

    return result;
  }

  async runForecast(asOfYear?: number, asOfMonth?: number): Promise<ProductForecastResult[]> {
    const anchorDate = this.resolveAnchorDate(asOfYear, asOfMonth);
    const cacheKey = `sales-forecast:run:${anchorDate.getFullYear()}-${anchorDate.getMonth() + 1}`;

    return this.cacheAsideSkipEmpty(cacheKey, FORECAST_CACHE_TTL_MS, async () => {
      const productHistories = await this.aggregateMonthlySales(anchorDate);
      if (productHistories.length === 0) {
        return [];
      }

      return this.callForecastService(productHistories);
    });
  }

  private resolveAnchorDate(asOfYear?: number, asOfMonth?: number): Date {
    const now = new Date();
    const year = asOfYear ?? now.getFullYear();
    const month = asOfMonth ?? now.getMonth() + 1;
    return new Date(year, month - 1, 1);
  }

  private async aggregateMonthlySales(anchorDate: Date) {
    const cutoffDate = new Date(anchorDate);
    cutoffDate.setMonth(cutoffDate.getMonth() - (HISTORY_MONTHS - 1));

    const periodEnd = new Date(anchorDate);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    const rows = await this.prisma.$queryRaw<MonthlySalesRow[]>`
      SELECT
        soi.product_id AS product_id,
        p.product_name AS product_name,
        DATE_FORMAT(so.order_date, '%Y-%m-01') AS month,
        SUM(soi.quantity) AS qty
      FROM sale_order_items soi
      INNER JOIN sales_orders so ON so.id = soi.sales_order_id AND so.deleted_at IS NULL
      INNER JOIN products p ON p.id = soi.product_id
      WHERE soi.deleted_at IS NULL
        AND p.is_active = 1
        AND p.is_sellable = 1
        AND so.order_date >= ${cutoffDate}
        AND so.order_date < ${periodEnd}
      GROUP BY soi.product_id, p.product_name, month
      ORDER BY soi.product_id, month
    `;

    const historyByProduct = new Map<
      number,
      { product_id: number; product_name: string; history: { date: string; qty: number }[] }
    >();

    for (const row of rows) {
      const productId = Number(row.product_id);
      if (!historyByProduct.has(productId)) {
        historyByProduct.set(productId, {
          product_id: productId,
          product_name: row.product_name,
          history: [],
        });
      }

      historyByProduct.get(productId)!.history.push({
        date: new Date(row.month).toISOString().slice(0, 10),
        qty: Number(row.qty),
      });
    }

    return Array.from(historyByProduct.values());
  }

  async getDailyOhlc(productId: number, year: number, month: number): Promise<DailyOhlcPoint[]> {
    const cacheKey = `sales-forecast:daily:${productId}:${year}-${month}`;

    return this.cacheAsideSkipEmpty(cacheKey, OHLC_CACHE_TTL_MS, async () => {
        const monthStart = new Date(year, month - 1, 1);
        const monthEnd = new Date(year, month, 1);

        const rows = await this.prisma.$queryRaw<DailyOrderRow[]>`
          SELECT
            DATE(so.order_date) AS day,
            soi.quantity AS quantity,
            so.id AS order_id,
            so.created_at AS created_at
          FROM sale_order_items soi
          INNER JOIN sales_orders so ON so.id = soi.sales_order_id AND so.deleted_at IS NULL
          WHERE soi.deleted_at IS NULL
            AND soi.product_id = ${productId}
            AND so.order_date >= ${monthStart}
            AND so.order_date < ${monthEnd}
          ORDER BY day ASC, so.created_at ASC, so.id ASC
        `;

        const byDay = new Map<string, number[]>();
        for (const row of rows) {
          const day = new Date(row.day).toISOString().slice(0, 10);
          if (!byDay.has(day)) {
            byDay.set(day, []);
          }
          byDay.get(day)!.push(Number(row.quantity));
        }

        return Array.from(byDay.entries())
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([date, quantities]) => ({
            date,
            open: quantities[0],
            close: quantities[quantities.length - 1],
            high: Math.max(...quantities),
            low: Math.min(...quantities),
          }));
    });
  }

  async getMonthlyOhlc(
    productId: number,
    asOfYear?: number,
    asOfMonth?: number,
  ): Promise<DailyOhlcPoint[]> {
    const anchorDate = this.resolveAnchorDate(asOfYear, asOfMonth);
    const cacheKey = `sales-forecast:monthly:${productId}:${anchorDate.getFullYear()}-${anchorDate.getMonth() + 1}`;

    return this.cacheAsideSkipEmpty(cacheKey, OHLC_CACHE_TTL_MS, async () => {
        const cutoffDate = new Date(anchorDate);
        cutoffDate.setMonth(cutoffDate.getMonth() - (HISTORY_MONTHS - 1));

        const periodEnd = new Date(anchorDate);
        periodEnd.setMonth(periodEnd.getMonth() + 1);

        const rows = await this.prisma.$queryRaw<MonthlyOrderRow[]>`
          SELECT
            DATE_FORMAT(so.order_date, '%Y-%m-01') AS month,
            soi.quantity AS quantity,
            so.id AS order_id,
            so.created_at AS created_at
          FROM sale_order_items soi
          INNER JOIN sales_orders so ON so.id = soi.sales_order_id AND so.deleted_at IS NULL
          WHERE soi.deleted_at IS NULL
            AND soi.product_id = ${productId}
            AND so.order_date >= ${cutoffDate}
            AND so.order_date < ${periodEnd}
          ORDER BY month ASC, so.created_at ASC, so.id ASC
        `;

        const byMonth = new Map<string, number[]>();
        for (const row of rows) {
          const month = new Date(row.month).toISOString().slice(0, 10);
          if (!byMonth.has(month)) {
            byMonth.set(month, []);
          }
          byMonth.get(month)!.push(Number(row.quantity));
        }

        return Array.from(byMonth.entries())
          .sort(([a], [b]) => (a < b ? -1 : 1))
          .map(([date, quantities]) => ({
            date,
            open: quantities[0],
            close: quantities[quantities.length - 1],
            high: Math.max(...quantities),
            low: Math.min(...quantities),
          }));
    });
  }

  private async callForecastService(
    products: { product_id: number; product_name: string; history: { date: string; qty: number }[] }[],
  ): Promise<ProductForecastResult[]> {
    const pythonBaseUrl = process.env.PYTHON_SERVER_URL?.replace(/\/+$/, '');
    if (!pythonBaseUrl) {
      this.logger.warn('PYTHON_SERVER_URL is not configured — skipping forecast.');
      return [];
    }

    try {
      const response = await axios.post(
        `${pythonBaseUrl}/forecast`,
        { products },
        { timeout: Number(process.env.PYTHON_SERVER_TIMEOUT ?? 120000) },
      );

      return response.data?.products ?? [];
    } catch (error) {
      this.logger.error('Forecast service call failed', error as Error);
      return [];
    }
  }
}
