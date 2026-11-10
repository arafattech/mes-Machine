import { CommonModule } from '@angular/common';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

interface HeatmapDay {
  date: string;
  day: number;
  value: number;
  percent: number;
  level: 0 | 1 | 2 | 3 | 4;
  levelLabel: string;
  isToday: boolean;
}

@Component({
  selector: 'app-shared-activity-heatmap',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shared-activity-heatmap.component.html',
  styleUrl: './shared-activity-heatmap.component.scss',
})
export class SharedActivityHeatmapComponent implements OnChanges {
  /** Raw points — any date not present is treated as zero activity. */
  @Input() data: any[] = [];
  /** Date field name on each `data` item. */
  @Input() dateField = 'date';
  /** Value field name on each `data` item. */
  @Input() valueField = 'value';
  /** How many trailing weeks to render, ending exactly on `endDate` (last cell in the grid). */
  @Input() weeks = 5;
  /** Last date shown — always the final cell in the grid, no padding past it. Defaults to
   * the most recent date found in `data`, or today. */
  @Input() endDate?: string;
  /** Base color the intensity shades are derived from. */
  @Input() color = '#0070f2';
  /** Fixed row height — cells stay this tall regardless of the card's available height,
   * so a short flex-sized parent never squeezes them down. */
  @Input() rowSize = '30px';
  /** Fill the parent's height instead: the 7 rows share it equally (no fixed rowSize), so the
   * whole grid fits a fixed-height card without scrolling. Parent must give this host a height. */
  @Input() fitHeight = false;

  get rowTemplate(): string {
    return this.fitHeight ? 'repeat(7, minmax(0, 1fr))' : `repeat(7, ${this.rowSize})`;
  }

  readonly levelLabels: Record<0 | 1 | 2 | 3 | 4, string> = {
    0: 'No activity',
    1: 'Low',
    2: 'Moderate',
    3: 'High',
    4: 'Peak',
  };
  /** Flattened column-major (each week's 7 days consecutive) — matches CSS grid-auto-flow: column. */
  cells: HeatmapDay[] = [];
  weekCount = 0;
  total = 0;
  /** Weekday name for each grid row — the window ends on `endDate`, so row 0 is not always Sunday. */
  rowLabels: string[] = [];
  /** Visible date span, e.g. "04 Sep – 08 Oct 2026", so the grid reads without hovering. */
  rangeLabel = '';

  ngOnChanges(changes: SimpleChanges): void {
    if (
      changes['data'] ||
      changes['weeks'] ||
      changes['dateField'] ||
      changes['valueField'] ||
      changes['endDate']
    ) {
      this.build();
    }
  }

  private build(): void {
    const byDate = new Map<string, number>();
    let maxDate = new Date();

    for (const item of this.data) {
      const rawDate = (item as any)[this.dateField];
      const value = Number((item as any)[this.valueField]) || 0;
      if (!rawDate) continue;
      const parsed = new Date(rawDate);
      if (isNaN(parsed.getTime())) continue;
      const key = parsed.toISOString().slice(0, 10);
      byDate.set(key, (byDate.get(key) ?? 0) + value);
      if (parsed > maxDate) maxDate = parsed;
    }

    this.total = Array.from(byDate.values()).reduce((sum, v) => sum + v, 0);

    const maxValue = Math.max(0, ...Array.from(byDate.values()));
    const step = maxValue / 4;

    const levelFor = (value: number): 0 | 1 | 2 | 3 | 4 => {
      if (value <= 0 || maxValue <= 0) return 0;
      if (value <= step) return 1;
      if (value <= step * 2) return 2;
      if (value <= step * 3) return 3;
      return 4;
    };


    // Trailing window of exactly `weeks` weeks, ending precisely on endDate (or the most
    // recent date in the data) — that date is always the very last cell, never padded past.
    const end = this.endDate ? new Date(this.endDate) : maxDate;
    const start = new Date(end);
    start.setDate(start.getDate() - this.weeks * 7 + 1);

    const weekCount = this.weeks;

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const cells: HeatmapDay[] = [];
    const cursor = new Date(start);

    for (let w = 0; w < weekCount; w++) {
      for (let d = 0; d < 7; d++) {
        const key = cursor.toISOString().slice(0, 10);
        const value = byDate.get(key) ?? 0;
        const level = levelFor(value);
        const percent = this.total > 0 ? Math.round((value / this.total) * 1000) / 10 : 0;
        cells.push({
          date: key,
          day: cursor.getDate(),
          value,
          percent,
          level,
          levelLabel: this.levelLabels[level],
          isToday: key === todayKey,
        });
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    this.cells = cells;
    this.weekCount = weekCount;

    const weekday = new Intl.DateTimeFormat(undefined, { weekday: 'short' });
    this.rowLabels = cells.slice(0, 7).map((c) => weekday.format(this.toLocalDate(c.date)));

    const dayMonth = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short' });
    const dayMonthYear = new Intl.DateTimeFormat(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    this.rangeLabel = cells.length
      ? `${dayMonth.format(this.toLocalDate(cells[0].date))} – ${dayMonthYear.format(this.toLocalDate(cells[cells.length - 1].date))}`
      : '';
  }

  /** `yyyy-MM-dd` → local-midnight Date (`new Date(key)` parses as UTC and can shift the day). */
  private toLocalDate(key: string): Date {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
}
