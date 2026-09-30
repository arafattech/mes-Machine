import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  NgZone
} from '@angular/core';
import { CommonModule } from '@angular/common';

import * as am4core from '@amcharts/amcharts4/core';
import * as am4charts from '@amcharts/amcharts4/charts';
import am4themes_animated from '@amcharts/amcharts4/themes/animated';

export interface AmChartDataPoint {
  x: string | number | Date;
  y: number;
}
export interface AmChartDataset {
  label: string;
  data: AmChartDataPoint[];
  backgroundColor?: string;
  borderColor?: string;
}

@Component({
  selector: 'app-am-activity-chart',
  templateUrl: './am-activity-chart.component.html',
  styleUrls: ['./am-activity-chart.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class AmActivityChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('chartdiv', { static: true }) chartdiv!: ElementRef<HTMLElement>;
  
  @Input() title: string = '';
  @Input() datasets: AmChartDataset[] = [];
  @Input() yMin: number = 0;
  @Input() yMax: number = 24;

  @Output() dataPointClicked = new EventEmitter<any>();

  private chart?: am4charts.XYChart;
  private monthLabel?: am4core.Label;

  constructor(private zone: NgZone) {}

  ngAfterViewInit(): void {
    this.zone.runOutsideAngular(() => {
      this.createChart();
      if (this.datasets && this.datasets.length) {
        this.updateSeries();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['datasets'] && !changes['datasets'].isFirstChange()) {
      this.zone.runOutsideAngular(() => {
        this.updateSeries();
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
    
    // Disable logo
    if (chart.logo) {
      chart.logo.disabled = true;
    }

    const xAxis = chart.xAxes.push(new am4charts.CategoryAxis());
    xAxis.dataFields.category = "dayOnly";
    xAxis.renderer.grid.template.location = 0;
    xAxis.renderer.minGridDistance = 15; // Lower distance to show more labels
    xAxis.renderer.labels.template.fontSize = 11;
    xAxis.renderer.labels.template.fill = am4core.color('#556b82');
    xAxis.renderer.grid.template.disabled = true;

    const yAxis = chart.yAxes.push(new am4charts.ValueAxis());
    yAxis.min = this.yMin;
    yAxis.max = this.yMax;
    yAxis.strictMinMax = true;
    
    // Disable default grid and labels so we can use strict custom axis ranges
    yAxis.renderer.grid.template.disabled = true;
    yAxis.renderer.labels.template.disabled = true;
    
    xAxis.cursorTooltipEnabled = false;
    yAxis.cursorTooltipEnabled = false;

    // Create strict custom grid intervals (0, 4, 8, 12, 16, 20, 24)
    for (let i = 0; i <= 24; i += 4) {
      const range = yAxis.axisRanges.create();
      range.value = i;
      range.grid.stroke = am4core.color("#cdd");
      range.grid.strokeDasharray = "4,4";
      range.grid.strokeOpacity = 0.4;
      range.label.text = String(i);
      range.label.fontSize = 11;
      range.label.fill = am4core.color('#556b82');
      range.label.location = 0; // Centers the label on the grid line vertically
    }

    yAxis.title.text = "Hours";
    yAxis.title.fontSize = 11;
    yAxis.title.fill = am4core.color('#556b82');

    chart.cursor = new am4charts.XYCursor();
    chart.cursor.behavior = "none";
    chart.cursor.lineX.strokeOpacity = 0.2;
    chart.cursor.lineY.strokeOpacity = 0;

    // Add Legend
    chart.legend = new am4charts.Legend();
    chart.legend.position = "top";
    chart.legend.contentAlign = "right";
    chart.legend.labels.template.fontSize = 12;
    chart.legend.labels.template.fill = am4core.color('#556b82');
    chart.legend.itemContainers.template.paddingTop = 5;
    chart.legend.itemContainers.template.paddingBottom = 5;
    chart.legend.markers.template.width = 12;
    chart.legend.markers.template.height = 12;

    // Add Month: [Current Month] label at the bottom center
    const monthLabel = chart.bottomAxesContainer.createChild(am4core.Label);
    monthLabel.align = "center";
    monthLabel.fontSize = 13;
    monthLabel.paddingTop = 15;
    monthLabel.fontWeight = "600";
    this.monthLabel = monthLabel;

    this.chart = chart;
  }

  private updateSeries(): void {
    if (!this.chart) return;

    if (this.monthLabel) {
      const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
      this.monthLabel.text = `Month: ${currentMonth}`;
      this.monthLabel.fill = am4core.color("#000000"); // Black color
    }

    const dateSet = new Set<string>();
    for (const ds of this.datasets) {
      for (const pt of ds.data) {
        dateSet.add(String(pt.x));
      }
    }
    const allDates = Array.from(dateSet);

    const rows: Record<string, any>[] = allDates.map((date) => {
      const dayOnly = date.split(' ')[1] || date;
      const row: Record<string, any> = { date, dayOnly };
      for (const ds of this.datasets) {
        const key = this.seriesKey(ds.label);
        const pt = ds.data.find((p) => String(p.x) === date);
        row[key] = pt ? Math.max(0, pt.y) : 0;
      }
      return row;
    });

    this.chart.data = rows;
    
    // Clear old series
    while(this.chart.series.length > 0) {
        this.chart.series.removeIndex(0).dispose();
    }

    const datasetsSnapshot = this.datasets.slice();

    this.datasets.forEach((ds, datasetIndex) => {
      const key = this.seriesKey(ds.label);
      let rawColor = ds.backgroundColor || ds.borderColor || '#3B82F6';
      
      const cssVarMatch = rawColor.match(/var\([^,]+,\s*([^)]+)\)/);
      if (cssVarMatch && cssVarMatch[1]) {
        rawColor = cssVarMatch[1].trim();
      }
      
      const color = am4core.color(rawColor);

      const series = this.chart!.series.push(new am4charts.ColumnSeries());
      series.name = ds.label;
      series.xAxis = this.chart!.xAxes.getIndex(0) as am4charts.CategoryAxis;
      series.yAxis = this.chart!.yAxes.getIndex(0) as am4charts.ValueAxis;
      series.dataFields.valueY = key;
      series.dataFields.categoryX = "dayOnly";
      series.stacked = true;
      series.columns.template.width = am4core.percent(70);
      series.columns.template.tooltipY = 0;
      
      series.columns.template.fill = color;
      series.columns.template.stroke = color;
      series.columns.template.column.cornerRadiusTopLeft = 3;
      series.columns.template.column.cornerRadiusTopRight = 3;
      series.columns.template.cursorOverStyle = am4core.MouseCursorStyle.pointer;
      
      const bullet = series.bullets.push(new am4charts.LabelBullet());
      bullet.label.text = "{valueY}\n{name}";
      bullet.label.fill = am4core.color("#ffffff");
      bullet.label.fontSize = 12;
      bullet.label.textAlign = "middle";
      bullet.locationY = 0.5;
      bullet.label.truncate = false;
      bullet.label.hideOversized = true;

      // Ensure tooltip gets the data context via adapter (apply to all, but only show for first visible to prevent duplicates)
      series.tooltipHTML = " "; // Dummy value to enable tooltip
      series.tooltip!.getFillFromObject = false;
      series.tooltip!.background.fill = am4core.color("#1e293b");
      series.tooltip!.background.strokeOpacity = 0;
      series.tooltip!.background.cornerRadius = 8;
      
      series.adapter.add("tooltipHTML", (html, target) => {
        const firstVisibleSeries = this.chart!.series.values.find(s => !s.isHidden && !s.isHiding);
        if (series !== firstVisibleSeries) {
          return "";
        }

        const dataItem = target.tooltipDataItem;
        if (!dataItem) return "";
        const dataContext = dataItem.dataContext as any;
        if (!dataContext) return "";
        const date = dataContext.date;
        
        const lines = datasetsSnapshot
          .filter((d) => {
            const s = this.chart!.series.values.find(s => s.name === d.label);
            return s && !s.isHidden && !s.isHiding;
          })
          .map((d) => {
            const val: number = dataContext[this.seriesKey(d.label)] ?? 0;
            const stateColor = d.backgroundColor || d.borderColor || '#3B82F6';
            const totalSeconds = Math.round(val * 3600);
            const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
            const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
            const s = (totalSeconds % 60).toString().padStart(2, '0');
            
            return (
              `<div style="display:flex;align-items:center;gap:6px;margin:2px 0">` +
              `<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${stateColor};flex-shrink:0"></span>` +
              `<span style="color:#cbd5e1;font-size:11px">${d.label}</span>` +
              `<span style="margin-left:auto;font-weight:600;color:#f1f5f9;font-size:11px;padding-left:12px">${h}:${m}:${s}</span>` +
              `</div>`
            );
          })
          .join('');

        return (
          `<div style="padding:4px">` +
          `<div style="font-weight:700;color:#e2e8f0;font-size:12px;margin-bottom:6px;border-bottom:1px solid #334155;padding-bottom:5px">` +
          `📅 ${date}</div>` +
          lines +
          `</div>`
        );
      });
      
      const hoverState = series.columns.template.states.create("hover");
      hoverState.properties.fillOpacity = 0.85;

      series.columns.template.events.on('hit', (ev: any) => {
        const dataItem = ev.target.dataItem;
        if (!dataItem) return;
        const dateLabel = dataItem.dataContext?.date;
        const dateIndex = allDates.indexOf(dateLabel);
        const dsPoint = ds.data[dateIndex];
        if (dsPoint != null) {
          this.zone.run(() => {
            this.dataPointClicked.emit({
              datasetIndex,
              dataIndex: dateIndex,
              value: dsPoint,
            });
          });
        }
      });
    });
  }

  private seriesKey(label: string): string {
    return 'val_' + label.replace(/[^a-zA-Z0-9_]/g, '_');
  }
}
