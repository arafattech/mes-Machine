import { Component, AfterViewInit, OnDestroy, ElementRef, ViewChild, Input, OnChanges, SimpleChanges } from '@angular/core';
import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';

am4core.useTheme(am4themes_animated);

@Component({
  selector: 'app-market-analysis-chart',
  templateUrl: './market-analysis-chart.component.html',
  styleUrl: './market-analysis-chart.component.scss'
})
export class MarketAnalysisChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartdiv', { static: true }) chartDiv!: ElementRef;

  @Input() data: any[] = [];
  @Input() chartHeight: string = '320px';
  @Input() categoryField: string = 'date';
  @Input() valueField: string = 'averagePrice';

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
    if (chart.logo) { chart.logo.disabled = true; }
    chart.data = this.data;

    chart.numberFormatter.numberFormat = "#.#a";
    chart.numberFormatter.bigNumberPrefixes = [
      { number: 1e3, suffix: "K" },
      { number: 1e5, suffix: "L" },
      { number: 1e7, suffix: "Cr" }
    ];

    const dateAxis = chart.xAxes.push(new am4charts.DateAxis());
    dateAxis.renderer.minGridDistance = 50;
    dateAxis.renderer.grid.template.disabled = true;
    dateAxis.renderer.labels.template.fontSize = 12;
    dateAxis.renderer.labels.template.fill = am4core.color("#64748B");
    dateAxis.dateFormats.setKey("month", "MMM");
    dateAxis.periodChangeDateFormats.setKey("month", "MMM");

    const valueAxis = chart.yAxes.push(new am4charts.ValueAxis());
    valueAxis.renderer.grid.template.strokeDasharray = "3,3";
    valueAxis.renderer.labels.template.fontSize = 12;
    valueAxis.renderer.labels.template.fill = am4core.color("#64748B");

    valueAxis.renderer.minLabelPosition = 0.05;
    valueAxis.renderer.maxLabelPosition = 0.95;

    const series = chart.series.push(new am4charts.LineSeries());
    series.dataFields.dateX = this.categoryField;
    series.dataFields.valueY = this.valueField;
    series.strokeWidth = 2;
    series.stroke = am4core.color("#3B82F6");
    series.tensionX = 0.8;
    series.fillOpacity = 0.15;
    series.fill = am4core.color("#3B82F6");

    series.tooltipText = "{valueY.formatNumber('#.#a')}";
    series.tooltip!.getFillFromObject = false;
    series.tooltip!.background.fill = am4core.color("#1E293B");
    series.tooltip!.label.fill = am4core.color("#FFFFFF");

    //HIDDEN: Draggable horizontal scrollbar logic removed temporary and need for future use
    /* const scrollbarX = new am4charts.XYChartScrollbar();
    chart.scrollbarX = scrollbarX;
    */

    chart.cursor = new am4charts.XYCursor();
    chart.cursor.lineY.disabled = true;
    chart.cursor.lineX.strokeOpacity = 0;
  }

  ngOnDestroy() {
    if (this.chart) { this.chart.dispose(); }
  }
}
