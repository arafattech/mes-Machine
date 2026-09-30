import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';

import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';

export interface DivergentBarData {
  category: string;
  good: number;
  wastage: number; // raw positive count — component normalises to %
}

@Component({
  selector: 'app-am-divergent-stacked-bar',
  templateUrl: './am-divergent-stacked-bar.component.html',
  styleUrls: ['./am-divergent-stacked-bar.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class AmDivergentStackedBarComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartdiv', { static: true }) chartdiv!: ElementRef<HTMLElement>;

  @Input() title: string = 'Today';
  @Input() data: DivergentBarData[] = [];

  get isEmpty(): boolean {
    return !this.data || this.data.length === 0;
  }

  private chart?: am4charts.XYChart;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.createChart();
      if (this.data && this.data.length) {
        this.updateData();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['data'] && !changes['data'].isFirstChange()) {
      this.zone.runOutsideAngular(() => {
        this.updateData();
      });
    }
  }

  ngOnDestroy(): void {
    this.zone.runOutsideAngular(() => {
      if (this.chart) {
        this.chart.dispose();
      }
    });
  }

  private createChart(): void {
    am4core.useTheme(am4themes_animated);
    const chart = am4core.create(this.chartdiv.nativeElement, am4charts.XYChart);

    if (chart.logo) chart.logo.disabled = true;

    // Padding
    chart.paddingLeft = 0;
    chart.paddingRight = 10;

    // ── Y-axis (categories) ─────────────────────────────────────────
    const yAxis = chart.yAxes.push(new am4charts.CategoryAxis());
    yAxis.dataFields.category = 'category';
    yAxis.renderer.inversed = true;
    yAxis.renderer.grid.template.location = 0;
    yAxis.renderer.minGridDistance = 20;
    yAxis.renderer.labels.template.fontSize = 11;
    yAxis.renderer.labels.template.fill = am4core.color('#556b82');
    yAxis.renderer.minWidth = 90; // enough room for "Mon, Aug 20"
    yAxis.renderer.cellStartLocation = 0.1;
    yAxis.renderer.cellEndLocation = 0.9;
    yAxis.renderer.grid.template.strokeOpacity = 0.1;

    // ── X-axis (values, fixed -100 to 100) ──────────────────────────
    const xAxis = chart.xAxes.push(new am4charts.ValueAxis());
    xAxis.min = -100;
    xAxis.max = 100;
    xAxis.strictMinMax = true;
    xAxis.renderer.minGridDistance = 40;
    xAxis.renderer.labels.template.fontSize = 11;
    xAxis.renderer.labels.template.fill = am4core.color('#556b82');
    xAxis.renderer.grid.template.strokeOpacity = 0.15;

    // Format axis labels as absolute percentage (no minus sign)
    xAxis.renderer.labels.template.adapter.add('text', (text, target) => {
      const di = target.dataItem as any;
      if (di && di.value != null) {
        return Math.abs(Math.round(di.value)) + '%';
      }
      return text;
    });

    // Centre divider line at x=0
    const centreRange = xAxis.axisRanges.create();
    centreRange.value = 0;
    centreRange.grid.stroke = am4core.color('#6c7b8a');
    centreRange.grid.strokeWidth = 2;
    centreRange.grid.strokeOpacity = 0.5;
    centreRange.grid.strokeDasharray = '4,4';

    // ── Wastage series (negative / left side) ───────────────────────
    const wastageSeries = chart.series.push(new am4charts.ColumnSeries());
    wastageSeries.dataFields.valueX = 'wastage';
    wastageSeries.dataFields.categoryY = 'category';
    wastageSeries.name = 'Wastage';
    wastageSeries.stacked = true;
    wastageSeries.fill = am4core.color('#bb0000');
    wastageSeries.stroke = am4core.color('#bb0000');
    wastageSeries.columns.template.tooltipText = 'Wastage: {wastageRaw} pcs ({wastagePct}%)';
    wastageSeries.columns.template.tooltipX = am4core.percent(50);
    wastageSeries.columns.template.tooltipY = am4core.percent(50);
    wastageSeries.tooltip = new am4core.Tooltip();
    wastageSeries.tooltip.pointerOrientation = 'right';

    this.addBullet(wastageSeries);

    // ── Good series (positive / right side) ─────────────────────────
    const goodSeries = chart.series.push(new am4charts.ColumnSeries());
    goodSeries.dataFields.valueX = 'good';
    goodSeries.dataFields.categoryY = 'category';
    goodSeries.name = 'Good';
    goodSeries.stacked = true;
    goodSeries.fill = am4core.color('#107e3e');
    goodSeries.stroke = am4core.color('#107e3e');
    goodSeries.columns.template.tooltipText = 'Good: {goodRaw} pcs ({goodPct}%)';
    goodSeries.columns.template.tooltipX = am4core.percent(50);
    goodSeries.columns.template.tooltipY = am4core.percent(50);
    goodSeries.tooltip = new am4core.Tooltip();
    goodSeries.tooltip.pointerOrientation = 'left';

    this.addBullet(goodSeries);

    // ── Cursor & Legend ──────────────────────────────────────────────
    chart.cursor = new am4charts.XYCursor();
    chart.cursor.behavior = 'none';
    chart.cursor.lineY.strokeOpacity = 0.15;
    chart.cursor.lineX.strokeOpacity = 0;

    chart.legend = new am4charts.Legend();
    chart.legend.position = 'bottom';
    chart.legend.contentAlign = 'center';
    chart.legend.labels.template.fontSize = 12;
    chart.legend.itemContainers.template.paddingTop = 4;
    chart.legend.itemContainers.template.paddingBottom = 4;

    this.chart = chart;
  }

  private addBullet(series: am4charts.ColumnSeries): void {
    const bullet = series.bullets.push(new am4charts.LabelBullet());
    bullet.label.adapter.add('text', (text, target) => {
      const val = (target.dataItem as any)?.valueX;
      if (val != null && Math.abs(val) >= 8) {
        return Math.abs(Math.round(val)) + '%';
      }
      return '';
    });
    bullet.label.fill = am4core.color('#ffffff');
    bullet.label.fontSize = 10;
    bullet.label.fontWeight = 'bold';
    bullet.locationX = 0.5;
    bullet.label.hideOversized = true;
    bullet.label.truncate = false;
  }

  private updateData(): void {
    if (!this.chart) return;

    const formattedData = this.data.map((item) => {
      const total = item.good + item.wastage;
      const goodPct  = total > 0 ? Math.round((item.good    / total) * 100) : 0;
      const wastagePct = total > 0 ? Math.round((item.wastage / total) * 100) : 0;
      return {
        category:   item.category,
        good:        goodPct,              // positive → right
        wastage:    -wastagePct,           // negative → left
        goodRaw:    item.good,
        wastageRaw: item.wastage,
        goodPct,
        wastagePct,
      };
    });

    this.chart.data = formattedData;
  }
}
