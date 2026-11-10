import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MetricColor } from '@app/modules/production-management/shared/utils/types';
import { Metric } from '@production-module/shared/interface/interface';

interface MetricPalette {
  /** SAP theme CSS var driving icon color, label color and accent bar. */
  color: string;
  /** SAP theme CSS var for the icon chip / tile tint background. */
  tint: string;
}

const METRIC_PALETTE: Record<MetricColor, MetricPalette> = {
  green: {
    color: 'var(--sapPositiveColor, #257a3e)',
    tint: 'var(--sapSuccessBackground, #f1fdf6)',
  },
  purple: {
    color: 'var(--sapInformationColor, #427cac)',
    tint: 'var(--sapInformationBackground, #e8f4fe)',
  },
  orange: {
    color: 'var(--sapCriticalColor, #e76500)',
    tint: 'var(--sapWarningBackground, #fef7f1)',
  },
  rose: {
    color: 'var(--sapNegativeColor, #bb0000)',
    tint: 'var(--sapErrorBackground, #ffebeb)',
  },
};

interface SizeClasses {
  tile: string;
  icon: string;
  label: string;
  value: string;
}

const SIZE_CLASSES: Record<'default' | 'compact', SizeClasses> = {
  default: { tile: 'p-4', icon: 'h-12 w-11 p-2.5', label: 'text-sm', value: 'text-2xl' },
  compact: { tile: 'p-3', icon: 'h-9 w-9 p-2', label: 'text-xs', value: 'text-lg' },
};

@Component({
  selector: 'app-quality-efficiency',
  templateUrl: './quality-efficiency.component.html',
  styleUrls: ['./quality-efficiency.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QualityEfficiencyComponent {
  @Input({ required: true }) metric!: Metric;
  /** `hero` = large featured tile (the OEE composite); `compact` = smaller contributing-factor tile. */
  @Input() variant: 'default' | 'compact' | 'hero' = 'default';

  get sizeClasses(): SizeClasses {
    return SIZE_CLASSES[this.variant === 'hero' ? 'default' : this.variant];
  }

  palette(color: MetricColor = 'green'): MetricPalette {
    return METRIC_PALETTE[color] ?? METRIC_PALETTE.green;
  }

  // arrow + color for delta
  get deltaInfo() {
    const d = this.metric.delta ?? 0;
    const up = d >= 0;
    return {
      arrow: up ? '▲' : '▼',
      color: up
        ? 'var(--sapPositiveColor, #257a3e)'
        : 'var(--sapNegativeColor, #bb0000)',
      abs: Math.abs(d).toLocaleString(undefined, { maximumFractionDigits: 2 }),
    };
  }

  formatValue(v: number | null, unit = '%') {
    return v === null ? $localize`n/a` : `${v}${unit}`;
  }
}
