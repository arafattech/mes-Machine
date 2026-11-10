import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  computed,
  inject,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TimeAgoPipe } from '@production-module/shared/pipes/time-ago.pipe';
import { MachineDashboardStore } from '@production-module/shared/services/machine-dashboard.store';
import { MACHINE_CONNECTIVITY_META } from '@production-module/shared/utils/machine-connectivity';
import { formatFactoryDate, formatFactoryTime } from '@shared/utilities/date-format';
import {
  getWorkOrderStatusColor,
  getWorkOrderStatusLabel,
  getWorkOrderStatusTint,
} from '@production-module/shared/utils/work-order-status.util';

/** Machine identity, live state and PLC communication — shared by the OEE and Runtime dashboards
 * (the Fiori dashboard uses `ui5-dynamic-page-title` instead). With `showProduction` (OEE) it also
 * shows what the machine is working on (order, product, shift) and the production actions. */
@Component({
  selector: 'app-machine-dashboard-header',
  standalone: true,
  imports: [DecimalPipe, RouterLink, TimeAgoPipe],
  templateUrl: './machine-dashboard-header.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class MachineDashboardHeaderComponent implements OnInit {
  /** `false` for state-only screens (Runtime): no order / product / shift, no production actions. */
  @Input() showProduction = true;
  @Output() logProduction = new EventEmitter<void>();

  protected readonly store = inject(MachineDashboardStore);
  protected readonly connectivity = computed(() => MACHINE_CONNECTIVITY_META[this.store.connectivity()]);
  /** Factory wall clock for state-only screens (wall displays), driven by the store's 1 s tick. */
  protected readonly clock = computed(() => {
    this.store.durations();
    const now = new Date();
    return { time: formatFactoryTime(now), date: formatFactoryDate(now) };
  }, { equal: (a, b) => a.time === b.time && a.date === b.date });
  protected readonly workOrderStatus = computed(() => {
    const status = this.store.currentWorkOrder()?.workOrder?.status ?? null;
    return status
      ? {
          label: getWorkOrderStatusLabel(status),
          color: getWorkOrderStatusColor(status),
          tint: getWorkOrderStatusTint(status),
        }
      : null;
  });

  ngOnInit(): void {
    if (this.showProduction) this.store.loadCurrentWorkOrder();
  }
}
