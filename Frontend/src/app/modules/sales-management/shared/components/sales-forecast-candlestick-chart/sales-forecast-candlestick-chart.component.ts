import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';

am4core.useTheme(am4themes_animated);

export interface OhlcPoint {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

@Component({
  selector: 'app-sales-forecast-candlestick-chart',
  templateUrl: './sales-forecast-candlestick-chart.component.html',
  styleUrl: './sales-forecast-candlestick-chart.component.scss',
})
export class SalesForecastCandlestickChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartdiv', { static: true }) chartDiv!: ElementRef;

  @Input() data: OhlcPoint[] = [];
  @Input() chartHeight: string = '320px';

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

    const dateAxis = chart.xAxes.push(new am4charts.DateAxis());
    dateAxis.renderer.minGridDistance = 40;
    dateAxis.renderer.grid.template.disabled = true;
    dateAxis.renderer.labels.template.fontSize = 11;
    dateAxis.renderer.labels.template.fill = am4core.color('#64748B');
    dateAxis.dateFormats.setKey('day', 'd MMM');
    dateAxis.periodChangeDateFormats.setKey('day', 'd MMM');

    const valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    valueAxis.renderer.grid.template.strokeDasharray = '3,3';
    valueAxis.renderer.labels.template.fontSize = 11;
    valueAxis.renderer.labels.template.fill = am4core.color('#64748B');
    valueAxis.renderer.minLabelPosition = 0.05;
    valueAxis.renderer.maxLabelPosition = 0.95;

    const series = chart.series.push(new am4charts.CandlestickSeries());
    series.dataFields.dateX = 'date';
    series.dataFields.valueY = 'close';
    series.dataFields.openValueY = 'open';
    series.dataFields.lowValueY = 'low';
    series.dataFields.highValueY = 'high';
    series.simplifiedProcessing = true;

    const riseColor = am4core.color('#10B981');
    const dropColor = am4core.color('#EF4444');
    series.columns.template.adapter.add('fill', (fill, target) => {
      const dataContext = target.dataItem?.dataContext as OhlcPoint | undefined;
      if (!dataContext) return fill;
      return dataContext.close < dataContext.open ? dropColor : riseColor;
    });
    series.columns.template.adapter.add('stroke', (stroke, target) => {
      const dataContext = target.dataItem?.dataContext as OhlcPoint | undefined;
      if (!dataContext) return stroke;
      return dataContext.close < dataContext.open ? dropColor : riseColor;
    });

    series.columns.template.strokeOpacity = 1;
    series.columns.template.tooltipText =
      'Open: {openValueY.value}\nHigh: {highValueY.value}\nLow: {lowValueY.value}\nClose: {valueY.value}';
    series.tooltip!.getFillFromObject = false;
    series.tooltip!.background.fill = am4core.color('#1E293B');
    series.tooltip!.label.fill = am4core.color('#FFFFFF');

    chart.cursor = new am4charts.XYCursor();
    chart.cursor.lineY.disabled = true;
    chart.cursor.lineX.strokeOpacity = 0;
  }

  ngOnDestroy() {
    if (this.chart) {
      this.chart.dispose();
    }
  }
}
