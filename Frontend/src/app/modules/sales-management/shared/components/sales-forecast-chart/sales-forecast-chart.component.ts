import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';

am4core.useTheme(am4themes_animated);

export interface SalesForecastChartPoint {
  date: string;
  actual: number | null;
  forecast: number | null;
}

@Component({
  selector: 'app-sales-forecast-chart',
  templateUrl: './sales-forecast-chart.component.html',
  styleUrl: './sales-forecast-chart.component.scss',
})
export class SalesForecastChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartdiv', { static: true }) chartDiv!: ElementRef;

  @Input() data: SalesForecastChartPoint[] = [];
  @Input() chartHeight: string = '360px';

  private chart!: am4charts.XYChart;

  ngAfterViewInit() {
    this.createChart();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] && this.chart) {
      this.chart.data = this.data;
    }
  }

  createChart() {
    const chart = am4core.create(this.chartDiv.nativeElement, am4charts.XYChart);
    this.chart = chart;

    chart.padding(5, 15, 0, 15);
    if (chart.logo) {
      chart.logo.disabled = true;
    }
    chart.data = this.data;

    chart.numberFormatter.numberFormat = '#.#a';
    chart.numberFormatter.bigNumberPrefixes = [
      { number: 1e3, suffix: 'K' },
      { number: 1e5, suffix: 'L' },
      { number: 1e7, suffix: 'Cr' },
    ];

    const dateAxis = chart.xAxes.push(new am4charts.DateAxis());
    dateAxis.renderer.minGridDistance = 60;
    dateAxis.renderer.grid.template.disabled = true;
    dateAxis.renderer.labels.template.fontSize = 12;
    dateAxis.renderer.labels.template.fill = am4core.color('#64748B');
    dateAxis.dateFormats.setKey('month', 'MMM yyyy');
    dateAxis.periodChangeDateFormats.setKey('month', 'MMM yyyy');

    const valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    valueAxis.renderer.grid.template.strokeDasharray = '3,3';
    valueAxis.renderer.labels.template.fontSize = 12;
    valueAxis.renderer.labels.template.fill = am4core.color('#64748B');
    valueAxis.renderer.minLabelPosition = 0.05;
    valueAxis.renderer.maxLabelPosition = 0.95;

    const actualSeries = chart.series.push(new am4charts.LineSeries());
    actualSeries.name = 'Actual';
    actualSeries.dataFields.dateX = 'date';
    actualSeries.dataFields.valueY = 'actual';
    actualSeries.strokeWidth = 2;
    actualSeries.stroke = am4core.color('#3B82F6');
    actualSeries.fill = am4core.color('#3B82F6');
    actualSeries.fillOpacity = 0.1;
    actualSeries.connect = false;
    actualSeries.tooltipText = 'Actual: {valueY.formatNumber("#.#a")}';
    actualSeries.tooltip!.getFillFromObject = false;
    actualSeries.tooltip!.background.fill = am4core.color('#1E293B');
    actualSeries.tooltip!.label.fill = am4core.color('#FFFFFF');

    const forecastSeries = chart.series.push(new am4charts.LineSeries());
    forecastSeries.name = 'Forecast';
    forecastSeries.dataFields.dateX = 'date';
    forecastSeries.dataFields.valueY = 'forecast';
    forecastSeries.strokeWidth = 2;
    forecastSeries.strokeDasharray = '6,4';
    forecastSeries.stroke = am4core.color('#F59E0B');
    forecastSeries.connect = false;
    forecastSeries.tooltipText = 'Forecast: {valueY.formatNumber("#.#a")}';
    forecastSeries.tooltip!.getFillFromObject = false;
    forecastSeries.tooltip!.background.fill = am4core.color('#1E293B');
    forecastSeries.tooltip!.label.fill = am4core.color('#FFFFFF');

    chart.cursor = new am4charts.XYCursor();
    chart.cursor.lineY.disabled = true;
    chart.cursor.lineX.strokeOpacity = 0;

    chart.legend = new am4charts.Legend();
    chart.legend.position = 'top';
    chart.legend.contentAlign = 'right';
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.dispose();
    }
  }
}
