import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';

@Component({
  selector: 'app-hrm-group-pie',
  templateUrl: './hrm-group-pie.component.html',
  styleUrl: './hrm-group-pie.component.scss'
})
export class HrmGroupPieComponent {
  @Input() labels: string[] = [];
  @Input() data: number[] = [];
  @Input() colors: string[] = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

  public pieChartData: ChartData<'doughnut'> = { labels: [], datasets: [] };
  public pieChartOptions: ChartOptions<'doughnut'> = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '75%',
    layout: {
    padding: {
      top: 10,
      bottom: 20, 
      left: 10,
      right: 10
    }},
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1E293B',
        callbacks: {
          label: (context: any) => ` ${context.label}: ${context.parsed}`
        }
      }
    }
  };

  ngOnChanges(changes: SimpleChanges) {
    if (changes['data'] || changes['labels']) {
      this.buildChart();
    }
  }

  buildChart() {
    this.pieChartData = {
      labels: this.labels,
      datasets: [{
        data: this.data,
        backgroundColor: this.colors,
        borderWidth: 0,
        hoverOffset: 15,
        borderRadius: 4,
      }]
    };
  }
}
