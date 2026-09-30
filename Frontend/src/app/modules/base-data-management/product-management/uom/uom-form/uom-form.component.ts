import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { Uom } from '@shared/model/uom';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';

@Component({
  selector: 'app-uom-form',
  templateUrl: './uom-form.component.html',
  styleUrl: './uom-form.component.scss',
})
export class UomFormComponent {
  @Input() saveMode = 'POST';
  @Output() UomAdded = new EventEmitter<Uom>();
  @Input() uom: Uom = new Uom().deserialize({});
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

  onSaveType() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'Uoms';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.uom.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Uoms(${this.uom.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.uom.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          const newUom = new Uom().deserialize(res);
          this.UomAdded.emit(newUom);
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
    if (!this.uom.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.uom = new Uom().deserialize({});
  }
}
