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
import { Chart, ChartConfiguration } from 'chart.js/auto';

export interface HrPayrollNutDataItem {
  label: string;
  value: number;
  color?: string;
}

@Component({
  selector: 'app-hr-payroll-nut',
  templateUrl: './hr-payroll-nut.component.html',
  styleUrl: './hr-payroll-nut.component.scss'
})
export class HrPayrollNutComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  @Input() items: HrPayrollNutDataItem[] = [];
  @Input() centerTitle: string = 'Totals';
  @Input() currency: string = '';
  @Input() decimals: number = 0;
  @Input() showCenterContent: boolean = true;

  private chart?: Chart<'doughnut'>;

  get firstItem(): HrPayrollNutDataItem | undefined {
    return this.items.at(0);
  }

  get secondItem(): HrPayrollNutDataItem | undefined {
    return this.items.at(1);
  }

  get total(): number {
    return this.items.reduce(
      (sum, dataItem) => sum + (Number(dataItem.value) || 0),
      0,
    );
  }

  ngAfterViewInit(): void {
    this.render();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['items'] && this.canvasRef) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = undefined;
    }
  }

  formatMoney(amount: number): string {
    const numericAmount = Number(amount || 0);
    return `${this.currency}${numericAmount.toLocaleString(undefined, {
      minimumFractionDigits: this.decimals,
      maximumFractionDigits: this.decimals,
    })}`;
  }

  private render(): void {
    if (!this.canvasRef) return;

    const labels = this.items.map((dataItem) => dataItem.label);
    const values = this.items.map((dataItem) => Number(dataItem.value) || 0);

    const colors = this.items.map((dataItem, itemIndex) => {
      if (dataItem.color) return dataItem.color;
      return itemIndex === 0 ? '#06b6d4' : '#34d399';
    });

    const config: ChartConfiguration<'doughnut'> = {
      type: 'doughnut',
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: colors,
            borderWidth: 0,
            hoverOffset: 2,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '78%',
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (tooltipContext) => {
                const itemLabel = tooltipContext.label ?? '';
                const itemValue = Number(tooltipContext.parsed || 0);
                return `${itemLabel}: ${this.formatMoney(itemValue)}`;
              },
            },
          },
        },
      },
    };

    if (this.chart) this.chart.destroy();
    this.chart = new Chart(this.canvasRef.nativeElement, config);
  }
}
