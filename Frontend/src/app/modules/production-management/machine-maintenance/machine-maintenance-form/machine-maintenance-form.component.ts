import { Component, Input, OnInit, Output, EventEmitter } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@app/shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { MachineMaintenanceService } from '@production-module/shared/services/machine-maintenance.service';
import { MachineMaintenanceSchedule } from '@production-module/shared/interface/interface';
import moment from 'moment';

interface OptionRow {
  id: number;
  text: string;
}

@Component({
  selector: 'app-machine-maintenance-form',
  templateUrl: './machine-maintenance-form.component.html',
  styleUrl: './machine-maintenance-form.component.scss',
})
export class MachineMaintenanceFormComponent implements OnInit {
  @Input() saveMode = 'POST';
  @Input() schedule: MachineMaintenanceSchedule | null = null;
  @Output() RefreshTable = new EventEmitter<any>();

  open = false;
  loading = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';

  public localization = Localization;

  machines: OptionRow[] = [];
  machineId: number | null = null;
  startDate = '';
  scheduledTime = '';
  reason = '';
  bufferEnabled = true;

  valueStateOptions = {
    machine: ValueState.None,
    startDate: ValueState.None,
    scheduledTime: ValueState.None,
    reason: ValueState.None,
  };

  constructor(
    private readonly commonService: CommonService,
    private readonly maintenanceService: MachineMaintenanceService,
    private readonly toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.getMachines();
  }

  private getMachines(): void {
    this.commonService
      .get<{ data: { id: number; machine_name: string }[] }>(
        'machines',
        false,
      )
      .subscribe({
        next: (res) => {
          this.machines = (res.data ?? []).map((m) => ({
            id: m.id,
            text: m.machine_name,
          }));
        },
        error: () => this.toastService.show('error'),
      });
  }

  openDialog(schedule: MachineMaintenanceSchedule | null): void {
    this.machineId = schedule?.machineId ?? null;
    const scheduledStartAt = schedule?.scheduledStartAt ?? moment().format(DATETIME_FORMAT);
    this.startDate = moment(scheduledStartAt).format(DATE_FORMAT);
    this.scheduledTime = moment(scheduledStartAt).format(TIME_FORMAT);
    this.reason = schedule?.reason ?? '';
    this.bufferEnabled = schedule?.bufferEnabled ?? true;
    this.valueStateOptions = {
      machine: ValueState.None,
      startDate: ValueState.None,
      scheduledTime: ValueState.None,
      reason: ValueState.None,
    };
    this.open = true;
  }

  onMachineChange(event: any): void {
    const id = Number(event?.target?.value);
    this.machineId = Number.isFinite(id) ? id : null;
    this.valueStateOptions.machine = ValueState.None;
  }

  onDateChange(event: any): void {
    this.startDate = event?.detail?.value ?? '';
    this.valueStateOptions.startDate = ValueState.None;
  }

  onTimeChange(event: any): void {
    this.scheduledTime = event?.detail?.value ?? '';
    this.valueStateOptions.scheduledTime = ValueState.None;
  }

  onReasonInput(event: any): void {
    this.reason = event?.target?.value ?? '';
    this.valueStateOptions.reason = ValueState.None;
  }

  onBufferEnabledChange(event: any): void {
    this.bufferEnabled = !!event?.target?.checked;
  }

  validateForm(): boolean {
    let isValid = true;
    if (this.machineId == null) {
      this.valueStateOptions.machine = ValueState.Negative;
      isValid = false;
    }
    if (!this.startDate) {
      this.valueStateOptions.startDate = ValueState.Negative;
      isValid = false;
    }
    if (!this.scheduledTime) {
      this.valueStateOptions.scheduledTime = ValueState.Negative;
      isValid = false;
    }
    if (!this.reason.trim()) {
      this.valueStateOptions.reason = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  save(): void {
    if (!this.validateForm()) return;
    if (this.machineId == null) return;

    const scheduledStartAt = moment(`${this.startDate} ${this.scheduledTime}`, `${DATE_FORMAT} ${TIME_FORMAT}`).format(
      DATETIME_FORMAT,
    );

    this.loading = true;
    let request$;

    if (this.saveMode === saveMode.POST) {
      this.ToastType = 'add';
      request$ = this.maintenanceService.create(
        this.machineId,
        scheduledStartAt,
        this.reason.trim(),
        this.bufferEnabled,
      );
    } else {
      this.ToastType = 'edit';
      request$ = this.maintenanceService.update(this.schedule?.id ?? -1, {
        machine_id: this.machineId,
        scheduled_start_at: scheduledStartAt,
        reason: this.reason.trim(),
        buffer_enabled: this.bufferEnabled,
      });
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
    this.machineId = null;
    this.startDate = '';
    this.scheduledTime = '';
    this.reason = '';
    this.bufferEnabled = true;
  }
}

/** `format-pattern` bound on the date picker. */
const DATE_FORMAT = 'YYYY-MM-DD';
/** `format-pattern` bound on the time picker — 12-hour clock with AM/PM. */
const TIME_FORMAT = 'hh:mm A';
/** Carbon-parseable on Laravel (`Y-m-d H:i:s`) — combined value sent to the backend. */
const DATETIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss';