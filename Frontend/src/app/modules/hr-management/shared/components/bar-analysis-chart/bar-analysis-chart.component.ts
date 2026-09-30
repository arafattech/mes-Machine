import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ChartData, ChartOptions } from 'chart.js';
@Component({
  selector: 'app-bar-analysis-chart',
  templateUrl: './bar-analysis-chart.component.html',
  styleUrl: './bar-analysis-chart.component.scss'
})
export class BarAnalysisChartComponent {
@Input() datasets: any[] = []; // Supports single or multiple bars (grouped)
  @Input() labels: string[] = [];
  @Input() chartHeight: string = '250px';
  @Input() isHorizontal: boolean = false; // Toggle for Task Achievement style

  public barChartData: ChartData<'bar'> = { labels: [], datasets: [] };
  
  public barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: true, position: 'top' },
      tooltip: { backgroundColor: '#1E293B' }
    },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, grid: { color: '#f1f5f9' } }
    }
  };

  ngOnChanges(changes: SimpleChanges) {
    if (changes['datasets'] || changes['labels']) {
      this.renderChart();
    }
  }

  renderChart() {
    this.barChartData = {
      labels: this.labels,
      datasets: this.datasets.map(ds => ({
        ...ds,
        borderRadius: 6,
        barThickness: 20,
        maxBarThickness: 30
      }))
    };
    
    // Switch axis if horizontal is requested
    this.barChartOptions.indexAxis = this.isHorizontal ? 'y' : 'x';
  }
}
