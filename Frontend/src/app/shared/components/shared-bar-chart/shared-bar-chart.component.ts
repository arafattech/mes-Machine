import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';

import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';
import { onChartThemeChange, readChartThemeColors } from '@shared/utilities/chart-theme';

am4core.useTheme(am4themes_animated);

@Component({
  selector: 'app-shared-bar-chart',
  standalone: true,
  templateUrl: './shared-bar-chart.component.html',
  styleUrl: './shared-bar-chart.component.scss',
})
export class SharedBarChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartdiv', { static: true }) chartDiv!: ElementRef;

  @Input() data: any[] = [];
  @Input() datasets: any[] = [];
  @Input() categoryField: string = 'category';
  @Input() valueField: string = 'value';
  @Input() chartHeight: string = '450px';
  /** Overrides amCharts' default bottom padding (~15px) — for compact fixed-height cards. */
  @Input() bottomPadding: number | null = null;
  /** Count data: whole-number axis ticks only (no '500m' / '1.5' on small ranges). */
  @Input() integerValues = false;
  @Input() barColor: string = '#3B82F6';
  // Default keeps only the first word of each category (compact axis for dense data). Enable for
  // multi-word categories that must stay readable (e.g. 'Not specified') — labels wrap instead.
  @Input() fullCategoryLabels = false;
  @Input() noDataMessage: string = $localize`No data available`;

  /** Set on every data load; drives the empty-state message instead of a blank plot. */
  hasData = false;

  private chart!: am4charts.XYChart;
  private series?: am4charts.ColumnSeries;

  private unsubscribeTheme?: () => void;

  ngAfterViewInit() {
    this.createChart();
    // Colors are resolved from the theme at build time, so rebuild once a new theme has applied.
    this.unsubscribeTheme = onChartThemeChange(() => {
      this.chart?.dispose();
      this.createChart();
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.chart) {
      return;
    }

    if (changes['categoryField'] || changes['valueField']) {
      this.chart.dispose();
      this.createChart();
      return;
    }

    if (changes['data'] || changes['datasets']) {
      this.setChartData();
    }

    if (changes['barColor'] && this.series) {
      this.series.columns.template.fill = am4core.color(this.barColor);
    }
  }

  private resolveData(): any[] {
    if (Array.isArray(this.data) && this.data.length > 0) {
      return this.data;
    }

    if (
      Array.isArray(this.datasets) &&
      this.datasets.length > 0 &&
      Array.isArray(this.datasets[0]?.data)
    ) {
      return this.datasets[0].data.map((item: any) => ({
        [this.categoryField]: item?.x,
        [this.valueField]: item?.y,
      }));
    }

    return [];
  }

  private createChart() {
    const { label, grid } = readChartThemeColors();
    const labelColor = am4core.color(label);
    const gridColor = am4core.color(grid);

    const chart = am4core.create(this.chartDiv.nativeElement, am4charts.XYChart);
    if (this.bottomPadding !== null) {
      chart.paddingBottom = this.bottomPadding;
    }
    this.chart = chart;

    if (chart.logo) {
      chart.logo.disabled = true;
    }

    this.setChartData();

    chart.numberFormatter.numberFormat = '#.#a';
    chart.numberFormatter.bigNumberPrefixes = [
      { number: 1e3, suffix: 'K' },
      { number: 1e5, suffix: 'L' },
      { number: 1e7, suffix: 'Cr' },
    ];

    const categoryAxis = chart.xAxes.push(new am4charts.CategoryAxis());
    categoryAxis.dataFields.category = this.categoryField;
    categoryAxis.renderer.grid.template.disabled = true;
    categoryAxis.renderer.minGridDistance = 30;
    categoryAxis.renderer.labels.template.fontSize = 12;
    categoryAxis.renderer.labels.template.fill = labelColor;

    if (this.fullCategoryLabels) {
      categoryAxis.renderer.labels.template.wrap = true;
      categoryAxis.renderer.labels.template.textAlign = 'middle';
      categoryAxis.renderer.labels.template.truncate = true;
      categoryAxis.renderer.labels.template.tooltipText = `{${this.categoryField}}`;
      // Each label gets only its own category slot so neighbours never overlap.
      categoryAxis.events.on('sizechanged', () => {
        const slots = Math.max(categoryAxis.dataItems.length, 1);
        categoryAxis.renderer.labels.template.maxWidth = Math.max(categoryAxis.pixelWidth / slots - 8, 30);
      });
    } else {
      categoryAxis.renderer.labels.template.adapter.add(
        'textOutput',
        (value: string) => {
          if (!value) {
            return value;
          }
          return value.split(/[-\s/]/)[0];
        }
      );
    }

    const valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    if (this.integerValues) {
      valueAxis.maxPrecision = 0;
    }
    valueAxis.min = 0;
    valueAxis.renderer.grid.template.strokeDasharray = '4,4';
    valueAxis.renderer.labels.template.fontSize = 12;
    valueAxis.renderer.labels.template.fill = labelColor;
    valueAxis.renderer.grid.template.stroke = gridColor;

    valueAxis.renderer.labels.template.adapter.add(
      'text',
      (value: string | undefined) => {
        if (!value) {
          return value;
        }

        const num = Number(value.replace(/,/g, ''));
        if (isNaN(num)) {
          return value;
        }

        if (num >= 100000) {
          return (num / 100000).toFixed(num % 100000 === 0 ? 0 : 1) + 'L';
        }

        if (num >= 1000) {
          return (num / 1000).toFixed(num % 1000 === 0 ? 0 : 1) + 'K';
        }

        return value;
      }
    );

    const series = chart.series.push(new am4charts.ColumnSeries());
    this.series = series;
    series.dataFields.valueY = this.valueField;
    series.dataFields.categoryX = this.categoryField;
    series.columns.template.width = am4core.percent(50);
    series.columns.template.column.cornerRadiusTopLeft = 6;
    series.columns.template.column.cornerRadiusTopRight = 6;
    series.columns.template.fill = am4core.color(this.barColor);
    series.columns.template.strokeOpacity = 0;
    series.columns.template.tooltipText = `{${this.categoryField}} : [bold]{valueY.formatNumber('#.#a')}[/]`;

    series.tooltip!.getFillFromObject = false;
    series.tooltip!.background.fill = am4core.color('#1E293B');
    series.tooltip!.label.fill = am4core.color('#FFFFFF');

    chart.cursor = new am4charts.XYCursor();
    chart.cursor.lineX.strokeOpacity = 0;
    chart.cursor.lineY.strokeOpacity = 0;
  }

  private setChartData() {
    if (!this.chart) {
      return;
    }

    const rows = this.resolveData();
    this.hasData = rows.length > 0;
    this.chart.data = [...rows];
    this.chart.invalidateData();
  }

  ngOnDestroy() {
    this.unsubscribeTheme?.();
    if (this.chart) {
      this.chart.dispose();
    }
  }
}
