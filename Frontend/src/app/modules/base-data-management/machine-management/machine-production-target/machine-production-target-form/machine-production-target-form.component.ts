import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';
import { MachineProductionTarget } from '@shared/model/machineProductionTarget';

@Component({
  selector: 'app-machine-production-target-form',
  templateUrl: './machine-production-target-form.component.html',
})
export class MachineProductionTargetFormComponent implements OnInit {
  @Input() saveMode = 'POST';
  @Input() machineProductionTarget: MachineProductionTarget = new MachineProductionTarget().deserialize({});
  @Output() RefreshTable = new EventEmitter<any>();
  open = false;
  loading = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  valueStateOptions = {
    machine_id: ValueState.None,
    target_qty: ValueState.None,
    effective_from: ValueState.None,
  };

  machines: { id: number; machine_name: string }[] = [];
  workOrders: { id: number; custom_id: string | null; product?: { product_name: string } }[] = [];
  shifts: { id: number; name: string }[] = [];

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.commonService.get<{ value: any[] }>('Machines', true).subscribe({
      next: (res) => (this.machines = res.value ?? []),
      error: () => this.toastService.show('error'),
    });
    this.commonService
      .get<{ value: any[] }>("WorkOrders?$filter=status ne 'cancelled'&$expand=product", true)
      .subscribe({ next: (res) => (this.workOrders = res.value ?? []) });
    this.commonService
      .get<{ value: any[] }>('EmployeeShifts?$filter=is_active eq true', true)
      .subscribe({ next: (res) => (this.shifts = res.value ?? []) });
  }

  onMachineChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.machineProductionTarget.machine_id = Number.isFinite(id) ? id : undefined;
  }

  onWorkOrderChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.machineProductionTarget.work_order_id = Number.isFinite(id) ? id : undefined;
  }

  onShiftChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.machineProductionTarget.shift_id = Number.isFinite(id) ? id : undefined;
  }

  /** `ui5-combobox` shows only its own `value`/typed text, not whichever `ui5-cb-item` has
   * `[selected]="true"` — these back the comboboxes' displayed text on edit-load, same
   * pattern `MachineConfigComponent`'s Machine Name combobox already uses. */
  get selectedMachineName(): string {
    return this.machines.find((m) => m.id === this.machineProductionTarget.machine_id)?.machine_name ?? '';
  }

  get selectedWorkOrderLabel(): string {
    const wo = this.workOrders.find((w) => w.id === this.machineProductionTarget.work_order_id);
    return wo ? `${wo.custom_id || 'WO-' + wo.id} · ${wo.product?.product_name ?? ''}` : '';
  }

  get selectedShiftName(): string {
    return this.shifts.find((s) => s.id === this.machineProductionTarget.shift_id)?.name ?? '';
  }

  onTargetQtyChange(event: any): void {
    const value = Number(event.target.value);
    this.machineProductionTarget.target_qty = Number.isFinite(value) ? value : 0;
  }

  AddProductionTarget(): void {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'MachineProductionTargets';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.machineProductionTarget.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `MachineProductionTargets(${this.machineProductionTarget.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.machineProductionTarget.toOdata(), true);
    }

    if (request$) {
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
  }

  private validateForm(): boolean {
    let isValid = true;
    this.valueStateOptions.machine_id = ValueState.None;
    this.valueStateOptions.target_qty = ValueState.None;
    this.valueStateOptions.effective_from = ValueState.None;

    if (!this.machineProductionTarget.machine_id) {
      this.valueStateOptions.machine_id = ValueState.Negative;
      isValid = false;
    }
    if (!this.machineProductionTarget.target_qty || this.machineProductionTarget.target_qty <= 0) {
      this.valueStateOptions.target_qty = ValueState.Negative;
      isValid = false;
    }
    if (!this.machineProductionTarget.effective_from) {
      this.valueStateOptions.effective_from = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog(): void {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.machine_id = ValueState.None;
    this.valueStateOptions.target_qty = ValueState.None;
    this.valueStateOptions.effective_from = ValueState.None;
    this.machineProductionTarget = new MachineProductionTarget().deserialize({});
  }
}
