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
import { CommonModule } from '@angular/common';

import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';
import { onChartThemeChange, readChartThemeColors } from '@shared/utilities/chart-theme';

am4core.useTheme(am4themes_animated);

const DEFAULT_DONUT_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f43f5e', '#14b8a6',
];

@Component({
  selector: 'app-shared-donut-chart',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './shared-donut-chart.component.html',
  styleUrl: './shared-donut-chart.component.scss',
})
export class SharedDonutChartComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild('chartdiv', { static: true }) chartDiv!: ElementRef;

  @Input() data: any[] = [];
  @Input() labels: string[] = [];
  @Input() valueField: string = 'amount';
  @Input() labelField: string = 'category';
  @Input() chartHeight: string = '300px';
  @Input() colors: string[] = [];
  @Input() innerRadius: number | string = 60;
  @Input() showLegend: boolean = true;
  @Input() legendPosition: 'right' | 'bottom' = 'bottom';
  @Input() tooltipMode: 'percent' | 'label' = 'percent';
  @Input() legendFontSize: number = 12;
  @Input() legendItemPaddingTop: number = 10;
  @Input() legendMarkerCornerRadius: number = 2;
  @Input() showSliceLabels: boolean = true;
  @Input() showSliceTicks: boolean = true;

  /** Built-in ring + side-list layout (used for "distribution" style charts) — set both to skip amCharts' own legend/labels and render a custom scrollable list instead. */
  @Input() showCenterOverlay: boolean = false;
  @Input() centerOverlayLabel: string = $localize`TOTAL`;
  @Input() centerOverlayValueSuffix: string = '%';
  @Input() showSideList: boolean = false;
  @Input() sideListValueSuffix: string = '%';
  /** Vertical position of the side list beside the ring. 'center' keeps a short list level with the donut. */
  @Input() sideListAlign: 'start' | 'center' = 'start';
  @Input() noDataMessage: string = $localize`No data available`;

  private chart!: am4charts.PieChart;
  private pieSeries!: am4charts.PieSeries;
  private unsubscribeTheme?: () => void;

  get paletteColors(): string[] {
    return this.colors?.length ? this.colors : DEFAULT_DONUT_COLORS;
  }

  get chartData(): any[] {
    return this.resolveData();
  }

  get centerTotal(): number {
    const total = this.chartData.reduce((sum, item) => sum + (Number(item?.[this.valueField]) || 0), 0);
    return Math.round(total);
  }

  getColor(index: number): string {
    return this.paletteColors[index % this.paletteColors.length];
  }

  ngAfterViewInit() {
    this.createChart();
    this.applyThemeColors();
    this.unsubscribeTheme = onChartThemeChange(() => this.applyThemeColors());
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.chart) {
      return;
    }

    if (changes['data'] || changes['colors'] || changes['labels']) {
      // Colors are matched to categories by position — the series' color list
      // must be rebuilt whenever the data (and therefore its category order)
      // changes, otherwise a stale list from an earlier render with a
      // different category mix silently drifts (e.g. "low" painted with
      // whatever color used to sit at that index).
      this.pieSeries.colors.list = this.paletteColors.map((c) => am4core.color(c));
      this.chart.data = this.resolveData();
      this.chart.invalidateData();
    }

    if (changes['innerRadius']) {
      this.chart.innerRadius = am4core.percent(this.parseRadius(this.innerRadius));
    }
  }

  private resolveData(): any[] {
    if (!Array.isArray(this.data) || this.data.length === 0) {
      return [];
    }

    const first = this.data[0];

    if (typeof first !== 'object' || first === null) {
      return this.data.map((value: any, index: number) => ({
        [this.labelField]: this.labels[index] ?? `Item ${index + 1}`,
        [this.valueField]: Number(value) || 0,
      }));
    }

    return this.data;
  }

  private parseRadius(val: string | number): number {
    return typeof val === 'number' ? val : parseInt(val, 10);
  }

  private applyThemeColors() {
    const { label, surface } = readChartThemeColors();
    const labelColor = am4core.color(label);
    this.pieSeries.labels.template.fill = labelColor;
    this.pieSeries.ticks.template.stroke = labelColor;
    this.pieSeries.slices.template.stroke = am4core.color(surface);
    if (this.chart.legend) {
      this.chart.legend.labels.template.fill = labelColor;
    }
  }

  private createChart() {
    const chart = am4core.create(this.chartDiv.nativeElement, am4charts.PieChart);
    this.chart = chart;

    if (chart.logo) {
      chart.logo.disabled = true;
    }

    chart.padding(10, 10, 10, 10);
    chart.data = this.resolveData();
    chart.innerRadius = am4core.percent(this.parseRadius(this.innerRadius));

    const pieSeries = chart.series.push(new am4charts.PieSeries());
    this.pieSeries = pieSeries;
    pieSeries.dataFields.value = this.valueField;
    pieSeries.dataFields.category = this.labelField;

    pieSeries.colors.list = this.paletteColors.map((c) => am4core.color(c));

    pieSeries.labels.template.fontSize = 12;
    pieSeries.labels.template.maxWidth = 120;
    pieSeries.labels.template.wrap = true;
    pieSeries.labels.template.disabled = !this.showSliceLabels;

    pieSeries.ticks.template.strokeOpacity = 0.5;
    pieSeries.ticks.template.disabled = !this.showSliceTicks;

    pieSeries.alignLabels = true;
    pieSeries.slices.template.tooltipText =
      this.tooltipMode === 'label'
        ? `{${this.labelField}}`
        : `{${this.labelField}}: [bold]{value.percent.formatNumber('#.0')}%[/]`;

    pieSeries.slices.template.strokeWidth = 2;
    pieSeries.slices.template.strokeOpacity = 1;

    const hoverState = pieSeries.slices.template.states.getKey('hover');
    if (hoverState) {
      hoverState.properties.scale = 1.05;
      hoverState.properties.fillOpacity = 1;
    }

    if (this.showLegend) {
      chart.legend = new am4charts.Legend();
      chart.legend.position = this.legendPosition;
      chart.legend.valign = 'bottom';
      chart.legend.contentAlign = 'center';
      chart.legend.labels.template.fontSize = this.legendFontSize;
      chart.legend.valueLabels.template.disabled = true;
      chart.legend.itemContainers.template.paddingTop = this.legendItemPaddingTop;
      chart.legend.useDefaultMarker = true;

      const marker = chart.legend.markers.template.children.getIndex(0);
      if (marker) {
        (marker as any).cornerRadius(
          this.legendMarkerCornerRadius,
          this.legendMarkerCornerRadius,
          this.legendMarkerCornerRadius,
          this.legendMarkerCornerRadius
        );
      }
    }
  }

  ngOnDestroy() {
    this.unsubscribeTheme?.();
    if (this.chart) {
      this.chart.dispose();
    }
  }
}
