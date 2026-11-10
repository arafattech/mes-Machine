import {
  Component,
  Input,
  Output,
  EventEmitter,
  computed,
  signal,
} from '@angular/core';
import { ChartConfiguration, ChartOptions, TooltipItem } from 'chart.js';
import { NgChartsModule } from 'ng2-charts';
import { DateHours } from '@production-module/shared/utils/types';
import { formatFactoryDayMonth } from '@shared/utilities/date-format';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  imports: [NgChartsModule],
  templateUrl: './line-chart.component.html',
  styleUrls: ['./line-chart.component.scss'],
})
export class LineChartComponent {
  @Input() title = 'Machine Runtime (Hours per Day)';
  //Data — one point per day, caller controls the range (no built-in month assumption).
  private _data = signal<DateHours[]>([]);
  @Input() set data(v: DateHours[]) {
    this._data.set(this.normalize(v));
  }
  get data() {
    return this._data();
  }
  /** Optional target line */
  private _target = signal<number | undefined>(undefined);
  @Input() set targetHoursPerDay(v: number | undefined) {
    this._target.set(v == null ? undefined : Math.max(0, Math.min(24, v)));
  }
  /** Appearance */
  @Input() lineLabel = 'Hours Run';
  @Input() lineColor = 'rgba(54,162,235,1)';
  @Input() fillColor = 'rgba(54,162,235,0.15)';
  @Input() targetColor = 'rgba(255,99,132,1)';
  @Input() showPoints = true;

  /** Interactions */
  @Output() dayClicked = new EventEmitter<DateHours>();

  /** Chart.js options */
  chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 250 },
    plugins: {
      legend: { display: true },
      tooltip: {
        callbacks: {
          title: (items) => (items.length ? `${items[0].label}` : ''),
          label: (ctx: TooltipItem<'line'>) => ` ${ctx.parsed.y ?? 0}h`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Date' },
        grid: { display: false },
        ticks: { autoSkip: true, maxRotation: 0 },
      },
      y: {
        title: { display: true, text: 'Hours (0–24)' },
        min: 0,
        max: 24,
        ticks: { stepSize: 4 },
      },
    },
    elements: {
      line: { tension: 0.25, borderWidth: 2 },
      point: { radius: 3, hoverRadius: 5 },
    },
  };

  /** Reactive dataset */
  chartData = computed<ChartConfiguration<'line'>['data']>(() => {
    const rows = this._data();
    const labels = rows.map((r) => this.formatDate(r.date));
    const series = rows.map((r) => r.hoursRun);

    const datasets: ChartConfiguration<'line'>['data']['datasets'] = [
      {
        label: this.lineLabel,
        data: series,
        borderColor: this.lineColor,
        backgroundColor: this.fillColor,
        pointBackgroundColor: this.lineColor,
        fill: true,
        pointRadius: this.showPoints ? 3 : 0,
        pointHoverRadius: this.showPoints ? 5 : 0,
      },
    ];

    const tgt = this._target();
    if (tgt !== undefined) {
      datasets.push({
        label: `Target (${tgt}h)`,
        data: Array(rows.length).fill(tgt),
        borderDash: [6, 6],
        borderColor: this.targetColor,
        backgroundColor: 'transparent',
        fill: false,
        pointRadius: 0,
        pointStyle: 'line',
      } as ChartConfiguration<'line'>['data']['datasets'][number]);
    }

    return { labels, datasets };
  });

  /** Click -> emit the selected day/value */
  onChartClick(evt: any) {
    const points = evt?.active as Array<any>;
    if (!points?.length) return;
    const idx = points[0].index as number;
    const row = this._data()[idx];
    if (row) this.dayClicked.emit(row);
  }

  private formatDate(date: Date): string {
    return formatFactoryDayMonth(date);
  }

  private normalize(rows: DateHours[]): DateHours[] {
    return (rows ?? [])
      .map((r) => ({ date: r.date, hoursRun: Math.max(0, Math.min(24, Math.round(r.hoursRun))) }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());
  }
}
