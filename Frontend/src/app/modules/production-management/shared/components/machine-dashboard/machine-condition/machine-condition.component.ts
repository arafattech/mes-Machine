import { CUSTOM_ELEMENTS_SCHEMA, ChangeDetectionStrategy, Component, Input, OnInit, computed, inject } from '@angular/core';
import { DurationPipe } from '@production-module/shared/pipes/duration.pipe';
import { TimeAgoPipe } from '@production-module/shared/pipes/time-ago.pipe';
import { MachineDashboardStore } from '@production-module/shared/services/machine-dashboard.store';
import { SensorStatus, dueText, limitsText } from '@production-module/shared/utils/machine-condition';

const SENSOR_STATUS_META: Record<SensorStatus, { label: string; color: string }> = {
  normal: { label: $localize`Within limits`, color: 'var(--sapPositiveTextColor)' },
  high: { label: $localize`Above limit`, color: 'var(--sapNegativeTextColor)' },
  low: { label: $localize`Below limit`, color: 'var(--sapInformativeTextColor, var(--sapInformationColor))' },
  unknown: { label: '', color: 'var(--sapContent_LabelColor)' },
};

/**
 * Maintenance (running / next / last) and the temperature + RPM sensors for the current machine —
 * shared by the OEE & Production and Runtime & Status dashboards. `layout="row"` lays the three
 * blocks side by side (Runtime), `"stack"` puts maintenance above the sensors (OEE side panel).
 * Sensor tiles appear only when the machine master enables them; missing readings say so.
 */
@Component({
  selector: 'app-machine-condition',
  standalone: true,
  imports: [DurationPipe, TimeAgoPipe],
  templateUrl: './machine-condition.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MachineConditionComponent implements OnInit {
  @Input() layout: 'row' | 'stack' = 'row';

  protected readonly store = inject(MachineDashboardStore);

  /** Layout classes live here (not in `[class.x]` bindings) because Tailwind's arbitrary-value
   * names contain brackets, which Angular can't bind; Tailwind scans `.ts` files too. The divider
   * colour stays a static class in the template (Ivy merges it with `[class]`). */
  protected get classes() {
    return this.layout === 'row'
      ? {
          root: 'h-full min-w-0 flex flex-row divide-x',
          maintenance: 'flex-[1.6] min-w-0 px-5 py-3 flex flex-col justify-center gap-1',
          sensors: 'flex-[2] min-w-0 flex divide-x',
          sensor: 'flex-1 min-w-0 px-4 py-2 flex flex-col justify-center',
        }
      : {
          root: 'min-w-0 flex flex-col divide-y',
          maintenance: 'min-w-0 pb-3 flex flex-col justify-center gap-1',
          sensors: 'min-w-0 pt-3 flex divide-x',
          sensor: 'flex-1 min-w-0 pr-3 [&+&]:pl-3 flex flex-col justify-center',
        };
  }

  protected readonly hasTemperature = computed(() => !!this.store.machine()?.hasTemperature);
  protected readonly hasRpm = computed(() => !!this.store.machine()?.hasRpm);

  protected readonly maintenance = computed(() => {
    const summary = this.store.maintenance();
    if (summary.kind === 'active') {
      this.store.durations();
      return { ...summary, elapsedSeconds: Math.max(0, Math.floor((Date.now() - summary.sinceMs) / 1000)) };
    }
    if (summary.kind === 'scheduled') {
      this.store.durations();
      return { ...summary, due: dueText(summary.dueMs, Date.now()) };
    }
    return summary;
  });

  protected readonly temperature = computed(() => {
    const t = this.store.temperature();
    const status = SENSOR_STATUS_META[t.status];
    const values = t.trend;
    const min = Math.min(...values);
    const max = Math.max(...values);
    return {
      ...t,
      text: t.value === null ? '—' : `${Math.round(t.value * 10) / 10}`,
      statusLabel: status.label,
      statusColor: status.color,
      limits: limitsText(t.min, t.max, '°C'),
      /** Trend bars scaled to the window's own range so small changes stay visible. */
      bars:
        values.length > 1
          ? values.map((v) => ({ heightPct: max > min ? 15 + ((v - min) / (max - min)) * 85 : 50 }))
          : [],
    };
  });

  protected readonly rpmLimits = computed(() => {
    const { minRpm, maxRpm } = this.store.sensorLimits();
    return limitsText(minRpm, maxRpm, 'rpm');
  });

  ngOnInit(): void {
    this.store.loadMachineCondition();
  }
}
