import { Component, EventEmitter, Input, Output } from '@angular/core';
import '@ui5/webcomponents/dist/StepInput.js';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@app/shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ScheduleFrequency } from '@production-module/shared/interface/interface';

const MIN_INTERVAL = 1;
const MAX_INTERVAL = 3650;

interface ScheduleFrequencyFormData {
  name: string;
  interval_days: number;
  is_active: boolean;
}

const emptyFormData = (): ScheduleFrequencyFormData => ({
  name: '',
  interval_days: 1,
  is_active: true,
});

@Component({
  selector: 'app-schedule-frequency-form',
  templateUrl: './schedule-frequency-form.component.html',
})
export class ScheduleFrequencyFormComponent {
  @Input() saveMode: string = saveMode.POST;
  @Output() formSubmitted = new EventEmitter<void>();

  displayDialog = false;
  saving = false;
  public localization = Localization;

  readonly minInterval = MIN_INTERVAL;
  readonly maxInterval = MAX_INTERVAL;

  formData = emptyFormData();
  valueStateOptions = { name: ValueState.None };

  private currentFrequencyId: number | null = null;

  constructor(
    private readonly commonService: CommonService,
    private readonly toastService: ToastService,
  ) {}

  openDialog(frequency: ScheduleFrequency | null): void {
    this.currentFrequencyId = frequency?.id ?? null;
    this.formData = frequency
      ? {
          name: frequency.name,
          interval_days: frequency.interval_days,
          is_active: frequency.is_active,
        }
      : emptyFormData();
    this.valueStateOptions = { name: ValueState.None };
    this.displayDialog = true;
  }

  closeDialog(): void {
    this.displayDialog = false;
  }

  onNameInput(event: Event): void {
    this.formData.name = (event.target as HTMLInputElement).value;
    this.valueStateOptions.name = ValueState.None;
  }

  onIntervalChange(event: Event): void {
    const value = Math.round(Number((event.target as HTMLInputElement).value));
    this.formData.interval_days = Number.isFinite(value)
      ? Math.min(MAX_INTERVAL, Math.max(MIN_INTERVAL, value))
      : MIN_INTERVAL;
  }

  onActiveChange(event: Event): void {
    this.formData.is_active = !!(event.target as HTMLInputElement).checked;
  }

  save(): void {
    if (!this.formData.name.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      return;
    }

    const payload = { ...this.formData, name: this.formData.name.trim() };
    const isCreate = this.saveMode === saveMode.POST;

    this.saving = true;

    const request$ = isCreate
      ? this.commonService.post('schedule-frequencies', payload, false)
      : this.commonService.put(`schedule-frequencies/${this.currentFrequencyId}`, payload, false);

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
