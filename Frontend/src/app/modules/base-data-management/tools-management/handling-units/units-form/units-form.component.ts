import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { HandlingUnit } from '@shared/model/handlingUnit';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';

@Component({
  selector: 'app-units-form',
  templateUrl: './units-form.component.html',
  styleUrl: './units-form.component.scss',
})
export class UnitsFormComponent {
  @Input() saveMode = 'POST';
  @Input() handlingUnit: HandlingUnit = new HandlingUnit().deserialize({});
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

  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {}

  AddUnit() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'HandlingUnits';
      this.ToastType = 'add';
      request$ = this.commonService.post(
        url,
        this.handlingUnit.toOdata(),
        true
      );
    } else if (this.saveMode === saveMode.PUT) {
      url = `HandlingUnits(${this.handlingUnit.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.handlingUnit.toOdata(), true);
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
    if (!this.handlingUnit.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.handlingUnit = new HandlingUnit().deserialize({});
  }
}
