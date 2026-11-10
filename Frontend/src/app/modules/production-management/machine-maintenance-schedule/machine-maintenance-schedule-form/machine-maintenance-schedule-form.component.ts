import { Component, EventEmitter, Input, Output } from '@angular/core';
import '@ui5/webcomponents/dist/StepInput.js';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@app/shared/enums/saveMode';
import { MaintenanceWorkTypeClass } from '@production-module/shared/enums/maintenance-work-type';
import { ScheduleFrequencyOption } from '@production-module/shared/interface/interface';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { formatFactoryDate, fromPickerDate } from '@shared/utilities/date-format';
import { DEFAULT_BUFFER_MINUTES, MAX_BUFFER_MINUTES, MIN_BUFFER_MINUTES, parseBufferMinutes } from '@production-module/shared/utils/maintenance-buffer';

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
  frequencies: ScheduleFrequencyOption[] = [];
  readonly workTypes = MaintenanceWorkTypeClass.getOptions();
  readonly minBufferMinutes = MIN_BUFFER_MINUTES;
  readonly maxBufferMinutes = MAX_BUFFER_MINUTES;

  formData = {
    machine_id: null as number | null,
    start_date: '',
    scheduled_time: '',
    schedule_frequency_id: null as number | null,
    type_of_work: null as string | null,
    is_active: true,
    buffer_enabled: true,
    buffer_minutes: DEFAULT_BUFFER_MINUTES,
  };

  valueStateOptions = {
    machine: ValueState.None,
    start_date: ValueState.None,
    scheduled_time: ValueState.None,
    frequency: ValueState.None,
    type_of_work: ValueState.None,
  };

  private currentScheduleId: number | null = null;

  constructor(
    private readonly commonService: CommonService,
    private readonly toastService: ToastService,
  ) {
    this.loadMachines();
    this.loadFrequencies();
  }

  /** Active frequencies, plus the schedule's current one even if it has since been deactivated. */
  get frequencyOptions(): ScheduleFrequencyOption[] {
    return this.frequencies.filter(
      (f) => f.is_active || f.id === this.formData.schedule_frequency_id,
    );
  }

  private loadFrequencies(): void {
    this.commonService
      .get<{ data: ScheduleFrequencyOption[] }>('schedule-frequencies/options', false)
      .subscribe((res) => {
        this.frequencies = res?.data ?? [];
      });
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
      schedule_frequency_id: null,
      type_of_work: null,
      is_active: true,
      buffer_enabled: true,
      buffer_minutes: DEFAULT_BUFFER_MINUTES,
    };
    this.valueStateOptions = {
      machine: ValueState.None,
      start_date: ValueState.None,
      scheduled_time: ValueState.None,
      frequency: ValueState.None,
      type_of_work: ValueState.None,
    };

    if (schedule) {
      this.currentScheduleId = schedule.id;
      
      this.formData = {
        machine_id: schedule.machine_id ? Number(schedule.machine_id) : null,
        start_date: formatFactoryDate(schedule.start_date),
        scheduled_time: schedule.scheduled_time || '',
        schedule_frequency_id: schedule.schedule_frequency_id ? Number(schedule.schedule_frequency_id) : null,
        type_of_work: schedule.type_of_work ?? null,
        is_active: schedule.is_active ?? true,
        buffer_enabled: schedule.buffer_enabled ?? true,
        buffer_minutes: schedule.buffer_minutes ?? DEFAULT_BUFFER_MINUTES,
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
    const id = Number(event?.target?.value);
    this.formData.schedule_frequency_id = Number.isFinite(id) ? id : null;
    this.valueStateOptions.frequency = ValueState.None;
  }

  onWorkTypeChange(event: any): void {
    this.formData.type_of_work = event?.target?.value || null;
    this.valueStateOptions.type_of_work = ValueState.None;
  }

  onActiveChange(event: any): void {
    this.formData.is_active = !!event?.target?.checked;
  }

  onBufferEnabledChange(event: any): void {
    this.formData.buffer_enabled = !!event?.target?.checked;
  }

  onBufferMinutesChange(event: Event): void {
    this.formData.buffer_minutes = parseBufferMinutes(event);
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
    if (!fromPickerDate(this.formData.start_date)) {
      this.valueStateOptions.start_date = ValueState.Negative;
      isValid = false;
    }
    if (!this.formData.scheduled_time) {
      this.valueStateOptions.scheduled_time = ValueState.Negative;
      isValid = false;
    }
    if (this.formData.schedule_frequency_id == null) {
      this.valueStateOptions.frequency = ValueState.Negative;
      isValid = false;
    }
    if (!this.formData.type_of_work) {
      this.valueStateOptions.type_of_work = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  save(): void {
    if (!this.validateForm()) {
      return;
    }

    const payload = { ...this.formData, start_date: fromPickerDate(this.formData.start_date) };
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
