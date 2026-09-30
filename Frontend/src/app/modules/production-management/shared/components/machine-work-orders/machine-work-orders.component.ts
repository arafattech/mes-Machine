import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { AssignedWorkOrder } from '@production-module/shared/interface/interface';
import {
  getWorkOrderStatusColor,
  getWorkOrderStatusLabel,
  getWorkOrderStatusTint,
} from '@production-module/shared/utils/work-order-status.util';

@Component({
  selector: 'app-machine-work-orders',
  templateUrl: './machine-work-orders.component.html',
})
export class MachineWorkOrdersComponent implements OnChanges {
  @Input() machineKey: string | null = null;
  /** Bumped by the parent after a manual production log — a fresh log can resolve a new
   * "current" work order or change an existing one's status, so this triggers a refetch
   * the same way a `workOrderId` change already does on `WorkOrderDetailComponent`. */
  @Input() refreshToken = 0;

  readonly getWorkOrderStatusColor = getWorkOrderStatusColor;
  readonly getWorkOrderStatusTint = getWorkOrderStatusTint;
  readonly getWorkOrderStatusLabel = getWorkOrderStatusLabel;

  loading = false;
  workOrders: AssignedWorkOrder[] = [];
  selectedWorkOrderId: number | null = null;

  constructor(private readonly overviewDataService: MachineOverviewDataService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['machineKey'] || changes['refreshToken']) {
      this.refresh();
    }
  }

  onSelectionChange(event: any): void {
    const selected = event?.detail?.selectedItems?.[0]?.value as AssignedWorkOrder | undefined;
    this.selectedWorkOrderId = selected?.id ?? null;
  }

  trackByWorkOrderId = (_: number, wo: AssignedWorkOrder): number => wo.id;

  private refresh(): void {
    if (!this.machineKey) {
      this.workOrders = [];
      this.selectedWorkOrderId = null;
      return;
    }

    const machineKey = this.machineKey;
    this.loading = true;
    this.overviewDataService.getAssignedWorkOrders(machineKey).subscribe((workOrders) => {
      this.workOrders = workOrders;
      this.resolveDefaultSelection(machineKey);
    });
  }

  /** Default selection = the "current" work order (latest logged bucket) if it's still
   * open; otherwise the first open work order; otherwise none. A previously-"current" WO
   * can fall out of the open list once it's marked completed/cancelled. */
  private resolveDefaultSelection(machineKey: string): void {
    this.overviewDataService.getCurrentWorkOrderShift(machineKey).subscribe((current) => {
      const currentId = current.workOrder?.id ?? null;
      const currentIsOpen = currentId !== null && this.workOrders.some((wo) => wo.id === currentId);

      this.selectedWorkOrderId = currentIsOpen ? currentId : (this.workOrders[0]?.id ?? null);
      this.loading = false;
    });
  }
}
