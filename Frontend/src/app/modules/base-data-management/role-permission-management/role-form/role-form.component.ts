import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Role } from '@shared/model/role';


@Component({
  selector: 'app-role-form',
  templateUrl: './role-form.component.html',
  styleUrl: './role-form.component.scss',
})
export class RoleFormComponent {
  @Input() saveMode = 'POST';
  role = new Role();
  @Output() onSuccess = new EventEmitter<any>();
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

  addRole() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'Roles';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.role.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Roles(${this.role.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.role.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          const roleSnapshot = { ...this.role };
          this.CloseDialog();
          this.onSuccess.emit({ response: res, role: roleSnapshot, saveMode: this.saveMode });
          this.toastService.show(this.ToastType);
        },
        error: (error: any) => {
          console.error('Error :', error);
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
    if (!this.role.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.role = new Role().deserialize({});
  }
}
