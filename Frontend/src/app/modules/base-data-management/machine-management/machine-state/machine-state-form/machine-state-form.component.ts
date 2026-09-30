import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';
import { MachineState } from '@shared/model/machineState';

@Component({
  selector: 'app-machine-state-form',
  templateUrl: './machine-state-form.component.html',
  styleUrl: './machine-state-form.component.scss',
})
export class MachineStateFormComponent {
  @Input() saveMode = 'POST';
  @Input() machineState: MachineState = new MachineState().deserialize({});
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() RefreshTable = new EventEmitter<any>();
  open: boolean = false;
  loading: boolean = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  valueStateOptions = {
    name: ValueState.None,
  };

  /** Curated subset of UI5 icon names relevant to a machine status — there is no
   * canonical/enumerable icon list elsewhere in the app to draw from, and the full
   * UI5 icon set (1000+) would make a plain dropdown unusable. Matches the icons this
   * status vocabulary already used as defaults (`MachineStatesSeeder`). */
  readonly iconOptions: string[] = [
    'media-play',
    'lateness',
    'media-pause',
    'wrench',
    'alert',
    'decline',
    'sys-enter-2',
    'sys-cancel',
    'pending',
    'stop',
    'tnt/etl-job',
    'question-mark',
  ];

  colorDialogOpen = false;
  selectedColor = '';

  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {}

  AddState() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'MachineStates';
      this.ToastType = 'add';
      request$ = this.commonService.post(
        url,
        this.machineState.toOdata(),
        true
      );
    } else if (this.saveMode === saveMode.PUT) {
      url = `MachineStates(${this.machineState.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.machineState.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          this.CloseDialog();
          this.RefreshTable.emit();
          this.toastService.show(this.ToastType);
        },
        error: (error: any) => {
          this.open = false;
          this.CloseDialog();
          this.toastService.show('error');
        },
      });
    }
  }

  checkValidation(event: any) {
    const value = event.target.value;
    if (!value.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
    } else {
      this.valueStateOptions.name = ValueState.None;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.machineState.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  onIconChange(event: any): void {
    const selectedOption = event?.detail?.selectedOption;
    this.machineState.icon = selectedOption?.getAttribute('value') ?? null;
  }

  openColorPickerDialog(): void {
    this.selectedColor = this.machineState.color || 'rgb(0, 128, 0)';
    this.colorDialogOpen = true;
  }

  closeColorPickerDialog(): void {
    this.colorDialogOpen = false;
  }

  onColorPickerChange(event: any): void {
    this.selectedColor = event.target.value;
  }

  confirmColor(): void {
    this.machineState.color = this.selectedColor;
    this.colorDialogOpen = false;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.colorDialogOpen = false;
    this.valueStateOptions.name = ValueState.None;
    this.machineState = new MachineState().deserialize({});
  }
}
