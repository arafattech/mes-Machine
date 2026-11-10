import { Component, ElementRef, EventEmitter, Injector, Input, OnInit, Output, afterNextRender } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@app/shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { fromPickerDate, isInvalidPickerDate } from '@shared/utilities/date-format';
import { apiErrorMessage } from '@shared/utilities/api-errors';
import { WorkOrder, WorkOrderStatus } from '@app/shared/model/work-order';
import { ProducibleProductPicker } from '@production-module/shared/services/producible-product-picker';

type Ui5FocusableElement = HTMLElement & { getFocusDomRef?: () => HTMLElement | undefined };

interface OptionRow {
  id: number;
  text: string;
}

@Component({
  selector: 'app-work-order-form',
  templateUrl: './work-order-form.component.html',
  styleUrl: './work-order-form.component.scss',
  providers: [ProducibleProductPicker],
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
    scheduledStart: ValueState.None,
    actualStart: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private host: ElementRef<HTMLElement>,
    private injector: Injector,
    readonly productPicker: ProducibleProductPicker,
  ) {}

  ngOnInit(): void {
    this.getMachines();
  }

  openDialog(): void {
    this.productPicker.reset();
    this.open = true;
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
    this.valueStateOptions.quantity = this.isValidQuantity() ? ValueState.None : ValueState.Negative;
  }

  private isValidQuantity(): boolean {
    const quantity = this.workOrder.quantity;
    return quantity !== null && Number.isInteger(quantity) && quantity >= 1;
  }

  /** Rejected submits always explain themselves and land the cursor on the first bad field. */
  private reportInvalidForm(): void {
    this.toastService.show('error', $localize`Please correct the highlighted fields.`);
    afterNextRender(
      () => {
        // UI5 elements expose their inner focusable element; their own `focus()` is deferred.
        const field = this.host.nativeElement.querySelector<Ui5FocusableElement>('[value-state="Negative"]');
        (field?.getFocusDomRef?.() ?? field)?.focus();
      },
      { injector: this.injector },
    );
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.workOrder.product_id) {
      this.valueStateOptions.product = ValueState.Negative;
      isValid = false;
    }
    if (!this.isValidQuantity()) {
      this.valueStateOptions.quantity = ValueState.Negative;
      isValid = false;
    }
    this.valueStateOptions.scheduledStart = fromPickerDate(this.workOrder.scheduled_start)
      ? ValueState.None
      : ValueState.Negative;
    this.valueStateOptions.actualStart = isInvalidPickerDate(this.workOrder.actual_start)
      ? ValueState.Negative
      : ValueState.None;
    return (
      isValid &&
      this.valueStateOptions.scheduledStart === ValueState.None &&
      this.valueStateOptions.actualStart === ValueState.None
    );
  }

  SaveWorkOrder(): void {
    if (!this.validateForm()) {
      this.reportInvalidForm();
      return;
    }

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
      error: (error) => {
        this.loading = false;
        this.toastService.show('error', apiErrorMessage(error));
      },
    });
  }

  CloseDialog(): void {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.product = ValueState.None;
    this.valueStateOptions.quantity = ValueState.None;
    this.valueStateOptions.scheduledStart = ValueState.None;
    this.valueStateOptions.actualStart = ValueState.None;
    this.workOrder = new WorkOrder().deserialize({});
  }
}
