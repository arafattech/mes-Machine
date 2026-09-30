import { Component, OnInit } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { SalesForecastChartPoint } from '@sales-module/shared/components/sales-forecast-chart/sales-forecast-chart.component';
import { OhlcPoint } from '@sales-module/shared/components/sales-forecast-candlestick-chart/sales-forecast-candlestick-chart.component';

interface ProductForecast {
  product_id: number;
  product_name: string;
  history: { date: string; qty: number }[];
  forecast: { date: string; qty: number }[];
  predicted_change_percent: number;
  risk: 'high' | 'medium' | 'low';
}

@Component({
  selector: 'app-sales-forecast',
  templateUrl: './sales-forecast.component.html',
  styleUrl: './sales-forecast.component.scss',
})
export class SalesForecastComponent implements OnInit {
  itemList: any[] = [];
  selectedProductId: number | null = null;
  selectedProductName: string = '';
  chartViewMode: 'GRAPH' | 'CANDLE' = 'GRAPH';
  productForecasts: ProductForecast[] = [];
  chartData: SalesForecastChartPoint[] = [];
  ohlcData: OhlcPoint[] = [];
  monthlyOhlcData: OhlcPoint[] = [];
  changeByProductChartData: { product: string; change: number }[] = [];
  riskDonutData: { level: string; count: number }[] = [];
  riskDonutColors: string[] = [];
  running: boolean = false;

  readonly months = [
    { value: 1, name: $localize`January` },
    { value: 2, name: $localize`February` },
    { value: 3, name: $localize`March` },
    { value: 4, name: $localize`April` },
    { value: 5, name: $localize`May` },
    { value: 6, name: $localize`June` },
    { value: 7, name: $localize`July` },
    { value: 8, name: $localize`August` },
    { value: 9, name: $localize`September` },
    { value: 10, name: $localize`October` },
    { value: 11, name: $localize`November` },
    { value: 12, name: $localize`December` },
  ];

  readonly years: number[] = Array.from(
    { length: 5 },
    (_, i) => new Date().getFullYear() - i,
  );

  private readonly defaultPeriod = (() => {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return { year: lastMonth.getFullYear(), month: lastMonth.getMonth() + 1 };
  })();

  selectedYear: number = this.defaultPeriod.year;
  selectedMonth: number = this.defaultPeriod.month;

  get selectedYearStr(): string {
    return this.selectedYear.toString();
  }

  get selectedMonthStr(): string {
    return this.selectedMonth.toString();
  }

  productDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  productToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`All Product Forecasts`,
    showNewButton: false,
    showSearch: true,
    showRowCount: false,
    showSegmentButton: false,
    showDownload: false,
  };

  productDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(38vh - 60px)',
    fillEmptyRows: true,
  };

  productColumns: AgGridTableColumn<any>[] = [
    {
      field: 'product_name',
      headerName: $localize`Product`,
      minWidth: 180,
      flex: 1,
    },
    {
      field: 'predicted_change_percent',
      headerName: $localize`Predicted Change`,
      minWidth: 150,
      dataType: GridTableColumnDataType.Number,
      valueFormatter: (params: any) =>
        `${params.value > 0 ? '+' : ''}${params.value}%`,
    },
    {
      field: 'risk',
      headerName: $localize`Risk`,
      minWidth: 110,
      cellRenderer: (params: any) => this.renderRiskCell(params.value),
    },
  ];

  readonly riskColors: { [key: string]: string } = {
    high: '#EF4444',
    medium: '#F59E0B',
    low: '#10B981',
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.getProductList();
    this.runForecast();
  }

  onPeriodChange() {
    this.runForecast();
  }

  printReport() {
    window.print();
  }

  onMonthChange(event: any) {
    const value = event.detail?.selectedOption?.value ?? event.target?.value;
    this.selectedMonth = Number(value);
    this.onPeriodChange();
  }

  onYearChange(event: any) {
    const value = event.detail?.selectedOption?.value ?? event.target?.value;
    this.selectedYear = Number(value);
    this.onPeriodChange();
  }

  private computeDerivedChartData() {
    this.changeByProductChartData = this.productForecasts
      .filter((p) => p.predicted_change_percent < 0)
      .sort((a, b) => a.predicted_change_percent - b.predicted_change_percent)
      .slice(0, 8)
      .map((p) => ({ product: p.product_name, change: Math.abs(p.predicted_change_percent) }));

    const levels: ('high' | 'medium' | 'low')[] = ['high', 'medium', 'low'];
    this.riskDonutData = levels
      .map((level) => ({
        level,
        count: this.productForecasts.filter((p) => p.risk === level).length,
      }))
      .filter((seg) => seg.count > 0);

    this.riskDonutColors = this.riskDonutData.map((seg) => this.riskColors[seg.level]);
  }

  get selectedProductForecast(): ProductForecast | undefined {
    return this.productForecasts.find((p) => p.product_id === this.selectedProductId);
  }

  getProductList() {
    this.commonService
      .get('/Products?$filter=is_active eq true and is_sellable eq true', true)
      .subscribe({
        next: (res: any) => {
          this.itemList = res.value || res;
        },
        error: (err) => console.error('Error fetching products:', err),
      });
  }

  onProductChange(event: any) {
    const item = event.detail.item;
    this.selectedProductId = item ? Number(item.getAttribute('id')) : null;
    this.selectedProductName = item ? item.getAttribute('text') : '';
    this.updateChartForSelectedProduct();
    this.loadDailyOhlc();
    this.loadMonthlyOhlc();
  }

  runForecast() {
    this.running = true;
    const body = { year: this.selectedYear, month: this.selectedMonth };
    this.commonService.post('sales/forecast/run', body, false, undefined, 'json', true).subscribe({
      next: (res: any) => {
        this.productForecasts = res?.data?.products || [];
        this.productDataSource = {
          ...this.productDataSource,
          data: this.productForecasts,
        };
        this.computeDerivedChartData();
        if (!this.selectedProductId && this.productForecasts.length > 0) {
          this.selectedProductId = this.productForecasts[0].product_id;
          this.selectedProductName = this.productForecasts[0].product_name;
        }
        this.updateChartForSelectedProduct();
        this.loadDailyOhlc();
        this.loadMonthlyOhlc();
        this.running = false;
        this.toastService.show('add');
      },
      error: (err) => {
        console.error('Error running forecast:', err);
        this.running = false;
      },
    });
  }

  private loadDailyOhlc() {
    if (!this.selectedProductId) {
      this.ohlcData = [];
      return;
    }

    const body = {
      product_id: this.selectedProductId,
      year: this.selectedYear,
      month: this.selectedMonth,
    };

    this.commonService.post('sales/forecast/daily', body, false, undefined, 'json', true).subscribe({
      next: (res: any) => {
        this.ohlcData = res?.data?.points || [];
      },
      error: (err) => {
        console.error('Error loading daily OHLC:', err);
        this.ohlcData = [];
      },
    });
  }

  private loadMonthlyOhlc() {
    if (!this.selectedProductId) {
      this.monthlyOhlcData = [];
      return;
    }

    const body = {
      product_id: this.selectedProductId,
      year: this.selectedYear,
      month: this.selectedMonth,
    };

    this.commonService.post('sales/forecast/monthly-ohlc', body, false, undefined, 'json', true).subscribe({
      next: (res: any) => {
        this.monthlyOhlcData = res?.data?.points || [];
      },
      error: (err) => {
        console.error('Error loading monthly OHLC:', err);
        this.monthlyOhlcData = [];
      },
    });
  }

  private updateChartForSelectedProduct() {
    const forecast = this.productForecasts.find(
      (p) => p.product_id === this.selectedProductId,
    );
    if (!forecast) {
      this.chartData = [];
      return;
    }

    const historyPoints: SalesForecastChartPoint[] = forecast.history.map((h) => ({
      date: h.date,
      actual: h.qty,
      forecast: null,
    }));

    const bridgePoint = forecast.history.length
      ? {
          date: forecast.history[forecast.history.length - 1].date,
          actual: forecast.history[forecast.history.length - 1].qty,
          forecast: forecast.history[forecast.history.length - 1].qty,
        }
      : null;

    const forecastPoints: SalesForecastChartPoint[] = forecast.forecast.map((f) => ({
      date: f.date,
      actual: null,
      forecast: f.qty,
    }));

    this.chartData = bridgePoint
      ? [...historyPoints.slice(0, -1), bridgePoint, ...forecastPoints]
      : [...historyPoints, ...forecastPoints];
  }

  private renderRiskCell(value: string): string {
    const bg = this.riskColors[value] || '#e0e0e0';
    return `<div style="min-width:80px;height:25px;border-radius:5px;background:${bg};display:flex;justify-content:center;align-items:center;text-transform:uppercase"><span style="color:black;font-weight:500;font-size:.8rem">${value}</span></div>`;
  }
}
