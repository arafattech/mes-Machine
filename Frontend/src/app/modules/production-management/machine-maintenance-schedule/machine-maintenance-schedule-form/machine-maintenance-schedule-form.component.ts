import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@app/shared/enums/saveMode';
import {
  MaintenanceFrequency,
  MaintenanceFrequencyClass,
} from '@production-module/shared/enums/maintenance-frequency';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import moment from 'moment';

interface OptionRow {
  id: number;
  text: string;
}

@Component({
  selector: 'app-machine-maintenance-schedule-form',
  templateUrl: './machine-maintenance-schedule-form.component.html',
  styleUrls: ['./machine-maintenance-schedule-form.component.scss'],
})
export class MachineMaintenanceScheduleFormComponent {
  @Input() saveMode: string = saveMode.POST;
  @Output() formSubmitted = new EventEmitter<any>();

  displayDialog = false;
  saving = false;
  public localization = Localization;

  machines: OptionRow[] = [];
  frequencies = MaintenanceFrequencyClass.getOptions();

  formData = {
    machine_id: null as number | null,
    start_date: '',
    scheduled_time: '',
    frequency: MaintenanceFrequency.FIFTEEN_DAYS as string,
    is_active: true,
    buffer_enabled: true,
  };

  valueStateOptions = {
    machine: ValueState.None,
    start_date: ValueState.None,
    scheduled_time: ValueState.None,
    frequency: ValueState.None,
  };

  private currentScheduleId: number | null = null;

  constructor(
    private readonly commonService: CommonService,
    private readonly toastService: ToastService,
  ) {
    this.loadMachines();
  }

  private loadMachines(): void {
    this.commonService
      .get<{ data: any[] }>('machines', false)
      .subscribe((res: any) => {
        this.machines = (res?.data || []).map((m: any) => ({
          id: m.id,
          text: m.machine_name,
        }));
      });
  }

  openDialog(schedule: any | null): void {
    this.displayDialog = true;
    this.currentScheduleId = null;

    this.formData = {
      machine_id: null,
      start_date: '',
      scheduled_time: '',
      frequency: MaintenanceFrequency.FIFTEEN_DAYS,
      is_active: true,
      buffer_enabled: true,
    };
    this.valueStateOptions = {
      machine: ValueState.None,
      start_date: ValueState.None,
      scheduled_time: ValueState.None,
      frequency: ValueState.None,
    };

    if (schedule) {
      this.currentScheduleId = schedule.id;
      
      this.formData = {
        machine_id: schedule.machine_id ? Number(schedule.machine_id) : null,
        start_date: schedule.start_date ? moment(schedule.start_date).format('YYYY-MM-DD') : '',
        scheduled_time: schedule.scheduled_time || '',
        frequency: schedule.frequency || MaintenanceFrequency.FIFTEEN_DAYS,
        is_active: schedule.is_active ?? true,
        buffer_enabled: schedule.buffer_enabled ?? true,
      };
    }
  }

  onMachineChange(event: any): void {
    const id = Number(event?.target?.value);
    this.formData.machine_id = Number.isFinite(id) ? id : null;
    this.valueStateOptions.machine = ValueState.None;
  }

  onDateChange(event: any): void {
    this.formData.start_date = event?.detail?.value ?? '';
    this.valueStateOptions.start_date = ValueState.None;
  }

  onTimeChange(event: any): void {
    this.formData.scheduled_time = event?.detail?.value ?? '';
    this.valueStateOptions.scheduled_time = ValueState.None;
  }

  onFrequencyChange(event: any): void {
    this.formData.frequency = event?.target?.value ?? MaintenanceFrequency.FIFTEEN_DAYS;
    this.valueStateOptions.frequency = ValueState.None;
  }

  onActiveChange(event: any): void {
    this.formData.is_active = !!event?.target?.checked;
  }

  onBufferEnabledChange(event: any): void {
    this.formData.buffer_enabled = !!event?.target?.checked;
  }

  closeDialog(): void {
    this.displayDialog = false;
  }

  validateForm(): boolean {
    let isValid = true;
    if (this.formData.machine_id == null) {
      this.valueStateOptions.machine = ValueState.Negative;
      isValid = false;
    }
    if (!this.formData.start_date) {
      this.valueStateOptions.start_date = ValueState.Negative;
      isValid = false;
    }
    if (!this.formData.scheduled_time) {
      this.valueStateOptions.scheduled_time = ValueState.Negative;
      isValid = false;
    }
    if (!this.formData.frequency) {
      this.valueStateOptions.frequency = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  save(): void {
    if (!this.validateForm()) {
      return;
    }

    const payload = { ...this.formData };
    const isCreate = this.saveMode === saveMode.POST;

    this.saving = true;

    const request$ = isCreate
      ? this.commonService.post('maintenance-schedules', payload, false)
      : this.commonService.put(`maintenance-schedules/${this.currentScheduleId}`, payload, false);

    request$.subscribe({
      next: () => {
        this.saving = false;
        this.toastService.show(isCreate ? 'save' : 'edit');
        this.closeDialog();
        this.formSubmitted.emit();
      },
      error: () => {
        this.saving = false;
        this.toastService.show('error');
      },
    });
  }
}
