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

export interface LineChartSeriesConfig {
  valueField: string;
  color: string;
  name: string;
}

@Component({
  selector: 'app-shared-line-chart',
  standalone: true,
  templateUrl: './shared-line-chart.component.html',
  styleUrl: './shared-line-chart.component.scss',
})
export class SharedLineChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartdiv', { static: true }) chartDiv!: ElementRef;

  @Input() data: any[] = [];
  @Input() categoryField: string = 'category';
  @Input() valueField: string = 'value';
  @Input() chartHeight: string = '450px';
  /** Overrides amCharts' default bottom padding (~15px) — for compact fixed-height cards. */
  @Input() bottomPadding: number | null = null;
  @Input() lineColor: string = '#3B82F6';
  // Legend label for the primary valueField line — only visible once `series` makes the legend appear.
  @Input() valueName?: string;
  // Extra named series (e.g. inbound/outbound) rendered on top of the primary valueField/lineColor
  // line. Leave empty to keep the original single-line behavior (used by purchase-home).
  @Input() series: LineChartSeriesConfig[] = [];

  private chart!: am4charts.XYChart;
  private primarySeries?: am4charts.LineSeries;

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

    if (changes['categoryField'] || changes['valueField'] || changes['series']) {
      this.chart.dispose();
      this.createChart();
      return;
    }

    if (changes['data']) {
      this.setChartData();
    }

    if (changes['lineColor'] && this.primarySeries) {
      this.primarySeries.stroke = am4core.color(this.lineColor);
      this.primarySeries.fill = am4core.color(this.lineColor);
    }
  }

  private createChart() {
    const { label, grid, text } = readChartThemeColors();
    const labelColor = am4core.color(label);
    const gridColor = am4core.color(grid);
    const textColor = am4core.color(text);

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
    categoryAxis.startLocation = 0.5;
    categoryAxis.endLocation = 0.5;

    const valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    valueAxis.min = 0;
    valueAxis.renderer.grid.template.strokeDasharray = '4,4';
    valueAxis.renderer.grid.template.stroke = gridColor;
    valueAxis.renderer.labels.template.fontSize = 12;
    valueAxis.renderer.labels.template.fill = labelColor;

    valueAxis.renderer.labels.template.adapter.add('text', (value: string | undefined) => {
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
    });

    if (this.series.length > 0) {
      this.primarySeries = this.createSeries(chart, this.valueField, this.lineColor, this.valueName, true);

      this.series.forEach((config) => {
        this.createSeries(chart, config.valueField, config.color, config.name, false);
      });

      chart.legend = new am4charts.Legend();
      chart.legend.position = 'bottom';
      if (this.bottomPadding !== null) {
        chart.legend.marginTop = 0;
        chart.legend.paddingBottom = 0;
      }
      chart.legend.labels.template.fontSize = 11;
      chart.legend.labels.template.fill = textColor;
      chart.legend.markers.template.width = 10;
      chart.legend.markers.template.height = 10;
    } else {
      this.primarySeries = this.createSeries(chart, this.valueField, this.lineColor, undefined, true);
    }

    chart.cursor = new am4charts.XYCursor();
    chart.cursor.lineY.strokeOpacity = 0;
  }

  private createSeries(
    chart: am4charts.XYChart,
    valueField: string,
    color: string,
    name: string | undefined,
    withFill: boolean
  ): am4charts.LineSeries {
    const series = chart.series.push(new am4charts.LineSeries());
    series.name = name ?? valueField;
    series.dataFields.valueY = valueField;
    series.dataFields.categoryX = this.categoryField;
    series.strokeWidth = 3;
    series.stroke = am4core.color(color);
    series.tensionX = 0.8;
    series.tooltipText = `${series.name} : [bold]{${valueField}.formatNumber('#.#a')}[/]`;

    series.fill = am4core.color(color);
    series.fillOpacity = withFill ? 0.12 : 0;

    const bullet = series.bullets.push(new am4charts.CircleBullet());
    bullet.circle.radius = 4;
    bullet.circle.fill = am4core.color(color);
    bullet.circle.strokeWidth = 2;
    bullet.circle.stroke = am4core.color('#FFFFFF');

    series.tooltip!.getFillFromObject = false;
    series.tooltip!.background.fill = am4core.color('#1E293B');
    series.tooltip!.label.fill = am4core.color('#FFFFFF');

    return series;
  }

  private setChartData() {
    if (!this.chart) {
      return;
    }

    this.chart.data = [...this.data];
    this.chart.invalidateData();
  }

  ngOnDestroy() {
    this.unsubscribeTheme?.();
    if (this.chart) {
      this.chart.dispose();
    }
  }
}
