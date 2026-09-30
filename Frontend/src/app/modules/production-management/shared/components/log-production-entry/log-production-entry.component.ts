import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ToastService } from '@app/services/toast-service/toast.service';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { AssignedWorkOrder, ShiftOption } from '@production-module/shared/interface/interface';

@Component({
  selector: 'app-log-production-entry',
  templateUrl: './log-production-entry.component.html',
})
export class LogProductionEntryComponent {
  @Input() machineKey: string | null = null;
  @Output() logged = new EventEmitter<void>();

  open = false;
  loading = false;

  workOrders: AssignedWorkOrder[] = [];
  shifts: ShiftOption[] = [];

  workOrderId: number | null = null;
  shiftId: number | null = null;
  goodCount: number | null = null;
  scrapCount: number | null = null;

  constructor(
    private readonly overviewDataService: MachineOverviewDataService,
    private readonly toastService: ToastService,
  ) {}

  openDialog(): void {
    if (!this.machineKey) return;
    this.open = true;
    this.resetForm();
    this.overviewDataService.getAssignedWorkOrders(this.machineKey).subscribe((wos) => {
      this.workOrders = wos;
    });
    this.overviewDataService.getActiveShifts().subscribe((shifts) => {
      this.shifts = shifts;
    });
  }

  closeDialog(): void {
    this.open = false;
  }

  onWorkOrderChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.workOrderId = Number.isFinite(id) ? id : null;
  }

  onShiftChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.shiftId = Number.isFinite(id) ? id : null;
  }

  onGoodCountChange(event: any): void {
    const value = Number(event.target.value);
    this.goodCount = Number.isFinite(value) ? value : null;
  }

  onScrapCountChange(event: any): void {
    const value = Number(event.target.value);
    this.scrapCount = Number.isFinite(value) ? value : null;
  }

  get isValid(): boolean {
    return (
      this.workOrderId !== null &&
      this.shiftId !== null &&
      this.goodCount !== null &&
      this.goodCount >= 0 &&
      this.scrapCount !== null &&
      this.scrapCount >= 0
    );
  }

  submit(): void {
    if (!this.machineKey || !this.isValid) return;

    this.loading = true;
    this.overviewDataService
      .logProductionCount(this.machineKey, {
        workOrderId: this.workOrderId!,
        shiftId: this.shiftId!,
        goodCount: this.goodCount!,
        scrapCount: this.scrapCount!,
      })
      .subscribe({
        next: () => {
          this.loading = false;
          this.toastService.show('add');
          this.closeDialog();
          this.logged.emit();
        },
        error: () => {
          this.loading = false;
          this.toastService.show('error');
        },
      });
  }

  private resetForm(): void {
    this.workOrderId = null;
    this.shiftId = null;
    this.goodCount = null;
    this.scrapCount = null;
  }
}
