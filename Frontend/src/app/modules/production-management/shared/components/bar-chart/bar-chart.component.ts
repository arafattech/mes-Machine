import {
  Component,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
} from '@angular/core';
import {
  ChartConfiguration,
  ChartOptions,
  ChartType,
  TooltipItem,
} from 'chart.js';
import { NgChartsModule } from 'ng2-charts';

export interface ChartDataPoint {
  x: string | number;
  y: number;
}

export interface ChartDataset {
  label: string;
  data: ChartDataPoint[];
  borderColor?: string;
  backgroundColor?: string;
  pointBackgroundColor?: string;
  fill?: boolean;
  borderDash?: number[];
  pointRadius?: number;
  pointHoverRadius?: number;
}

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  imports: [NgChartsModule],
  templateUrl: './bar-chart.component.html',
  styleUrls: ['./bar-chart.component.scss'],
})
export class BarChartComponent {
  @Input() title = 'Chart Title';
  @Input() chartType: ChartType = 'line';
  @Input() xAxisLabel = 'X Axis';
  @Input() yAxisLabel = 'Y Axis';
  @Input() yMin: number | undefined = undefined;
  @Input() yMax: number | undefined = undefined;
  @Input() yStepSize: number | undefined = undefined;

  // Data
  private _datasets = signal<ChartDataset[]>([]);
  @Input() set datasets(v: ChartDataset[]) {
    this._datasets.set(this.normalize(v));
  }
  get datasets() {
    return this._datasets();
  }

  // Appearance
  @Input() showPoints = true;
  @Input() showLegend = true;
  @Input() responsive = true;
  @Input() maintainAspectRatio = false;

  // Interactions
  @Output() dataPointClicked = new EventEmitter<{
    datasetIndex: number;
    dataIndex: number;
    value: ChartDataPoint;
  }>();
  @Output() dataPointHovered = new EventEmitter<{
    datasetIndex: number;
    dataIndex: number;
    value: ChartDataPoint;
  }>();

  // Custom chart options to allow overriding defaults
  @Input() customChartOptions: ChartOptions = {};

  /** Chart.js options */
  chartOptions = computed<ChartOptions>(() => ({
    responsive: this.responsive,
    maintainAspectRatio: this.maintainAspectRatio,
    animation: { duration: 250 },
    plugins: {
      legend: { display: this.showLegend },
      tooltip: {
        callbacks: {
          title: (items) =>
            items.length ? `${this.xAxisLabel}: ${items[0].label}` : '',
          label: (ctx: TooltipItem<any>) =>
            ` ${this.yAxisLabel}: ${ctx.parsed.y ?? 0}`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: this.xAxisLabel },
        grid: { display: false },
        ticks: { autoSkip: true, maxRotation: 0 },
      },
      y: {
        title: { display: true, text: this.yAxisLabel },
        min: this.yMin,
        max: this.yMax,
        ticks: this.yStepSize ? { stepSize: this.yStepSize } : undefined,
      },
    },
    elements: {
      line: { tension: 0.25, borderWidth: 2 },
      point: {
        radius: this.showPoints ? 3 : 0,
        hoverRadius: this.showPoints ? 5 : 0,
      },
    },
    ...this.customChartOptions, // Merge custom options
  }));

  /** Reactive dataset */
  chartData = computed<ChartConfiguration['data']>(() => {
    const labels = this.generateLabels();
    const datasets = this._datasets().map((dataset) => ({
      label: dataset.label,
      data: dataset.data.map((d) => d.y),
      borderColor: dataset.borderColor || 'rgba(54,162,235,1)',
      backgroundColor: dataset.backgroundColor || 'rgba(54,162,235,0.15)',
      pointBackgroundColor: dataset.pointBackgroundColor || dataset.borderColor,
      fill: dataset.fill ?? true,
      pointRadius: dataset.pointRadius ?? (this.showPoints ? 3 : 0),
      pointHoverRadius: dataset.pointHoverRadius ?? (this.showPoints ? 5 : 0),
      borderDash: dataset.borderDash,
    }));

    return { labels, datasets };
  });

  /** Click handler */
  onChartClick(evt: any) {
    const points = evt?.active as Array<any>;
    if (!points?.length) return;
    const { datasetIndex, index } = points[0];
    const value = this._datasets()[datasetIndex].data[index];
    if (value)
      this.dataPointClicked.emit({ datasetIndex, dataIndex: index, value });
  }

  /** Hover handler */
  onChartHover(evt: any) {
    const points = evt?.active as Array<any>;
    if (!points?.length) return;
    const { datasetIndex, index } = points[0];
    const value = this._datasets()[datasetIndex].data[index];
    if (value)
      this.dataPointHovered.emit({ datasetIndex, dataIndex: index, value });
  }

  // --- helpers ---
  // Preserves caller-supplied order rather than re-sorting `x` as a string — callers
  // pass chronologically/logically ordered points (e.g. formatted dates like "Jun 1"/"Jun 10"),
  // and a naive string sort corrupts that order (lexicographic, not chronological).
  private normalize(datasets: ChartDataset[]): ChartDataset[] {
    return datasets.map((dataset) => ({
      ...dataset,
      data: dataset.data.map((d) => ({
        x: d.x,
        y: Math.max(0, Math.round(d.y)),
      })),
    }));
  }

  private generateLabels(): string[] {
    const allX = this._datasets()
      .flatMap((d) => d.data.map((p) => p.x))
      .filter((x, i, arr) => arr.indexOf(x) === i);
    return allX.map((x) => `${x}`);
  }
}
