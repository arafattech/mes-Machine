import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@app/shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { WorkOrder, WorkOrderStatus } from '@app/shared/model/work-order';

interface OptionRow {
  id: number;
  text: string;
}

@Component({
  selector: 'app-work-order-form',
  templateUrl: './work-order-form.component.html',
  styleUrl: './work-order-form.component.scss',
})
export class WorkOrderFormComponent implements OnInit {
  @Input() saveMode = 'POST';
  @Input() workOrder: WorkOrder = new WorkOrder().deserialize({});
  @Output() RefreshTable = new EventEmitter<any>();

  open = false;
  loading = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  public localization = Localization;
  public valueState = ValueState;

  Products: OptionRow[] = [];
  Machines: OptionRow[] = [];

  readonly statusOptions: { value: WorkOrderStatus; label: string }[] = [
    { value: 'pending', label: $localize`Pending` },
    { value: 'in_progress', label: $localize`In Progress` },
    { value: 'completed', label: $localize`Completed` },
    { value: 'cancelled', label: $localize`Cancelled` },
  ];

  valueStateOptions = {
    product: ValueState.None,
    quantity: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.getProducts();
    this.getMachines();
  }

  private getProducts(): void {
    this.commonService
      .get<{ value: { id: number; product_name: string }[] }>(
        'Products?$filter=is_active eq true&$select=id,product_name',
        true,
      )
      .subscribe({
        next: (res) => {
          this.Products = (res.value ?? []).map((p) => ({
            id: p.id,
            text: p.product_name,
          }));
        },
        error: () => this.toastService.show('error'),
      });
  }

  private getMachines(): void {
    this.commonService
      .get<{ data: { id: number; machine_name: string }[] }>(
        'machines',
        false,
      )
      .subscribe({
        next: (res) => {
          this.Machines = (res.data ?? []).map((m) => ({
            id: m.id,
            text: m.machine_name,
          }));
        },
        error: () => this.toastService.show('error'),
      });
  }

  onProductSelection(event: any): void {
    const item = event?.detail?.item;
    const id = Number(item?.value);
    this.workOrder.product_id = Number.isFinite(id) ? id : null;
    this.workOrder.product_name = item?.text ?? '';
    this.valueStateOptions.product = ValueState.None;
  }

  onMachinesSelectionChange(event: any): void {
    const items = event?.detail?.items ?? [];
    this.workOrder.machine_ids = items.map((item: any) => Number(item.id));
    this.workOrder.machine_names = items.map((item: any) => item.text);
  }

  isMachineSelected(machineId: number): boolean {
    return this.workOrder.machine_ids.includes(machineId);
  }

  onStatusChange(event: any): void {
    const value = event?.target?.value as WorkOrderStatus;
    if (value) this.workOrder.status = value;
  }

  onQuantityChange(event: any): void {
    const value = Number(event.target.value);
    this.workOrder.quantity = Number.isFinite(value) ? value : null;
    this.valueStateOptions.quantity =
      this.workOrder.quantity && this.workOrder.quantity > 0
        ? ValueState.None
        : ValueState.Negative;
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.workOrder.product_id) {
      this.valueStateOptions.product = ValueState.Negative;
      isValid = false;
    }
    if (!this.workOrder.quantity || this.workOrder.quantity <= 0) {
      this.valueStateOptions.quantity = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  SaveWorkOrder(): void {
    if (!this.validateForm()) return;

    this.loading = true;
    let request$;

    if (this.saveMode === saveMode.POST) {
      this.ToastType = 'add';
      request$ = this.commonService.post(
        'work-orders',
        this.workOrder.toPayload(),
        false,
      );
    } else {
      this.ToastType = 'edit';
      request$ = this.commonService.put(
        `work-orders/${this.workOrder.id}`,
        this.workOrder.toPayload(),
        false,
      );
    }

    request$.subscribe({
      next: () => {
        this.CloseDialog();
        this.RefreshTable.emit();
        this.toastService.show(this.ToastType);
      },
      error: () => {
        this.loading = false;
        this.toastService.show('error');
      },
    });
  }

  CloseDialog(): void {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.product = ValueState.None;
    this.valueStateOptions.quantity = ValueState.None;
    this.workOrder = new WorkOrder().deserialize({});
  }
}
