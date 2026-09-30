import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { SalaryType } from '@app/modules/hr-management/shared/models/SalaryType';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ComboBoxComponent } from '@ui5/webcomponents-ngx';

@Component({
  selector: 'app-salary-type-form',
  standalone: true,
  imports: [ComboBoxComponent],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './salary-type-form.component.html',
  styleUrl: './salary-type-form.component.scss',
})
export class SalaryTypeFormComponent {
  @Input() saveMode = 'POST';
  @Input() salaryType: SalaryType = new SalaryType().deserialize({});
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

  onTypeChange(event: any) {
    this.salaryType.type = event.detail.item.text;
  }

  onSaveType() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'SalaryTypes';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.salaryType.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `SalaryTypes(${this.salaryType.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.salaryType.toOdata(), true);
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
    if (!this.salaryType.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.salaryType = new SalaryType().deserialize({});
  }
}
