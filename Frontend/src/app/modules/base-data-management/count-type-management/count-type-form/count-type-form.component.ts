import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { CountType } from '@app/shared/model/countType';
import { saveMode } from '@app/shared/enums/saveMode';
import { Localization } from '@app/shared/utilities/localization';
import { ValueState } from '@app/shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';

@Component({
  selector: 'app-count-type-form',
  templateUrl: './count-type-form.component.html',
  styleUrl: './count-type-form.component.scss',
})
export class CountTypeFormComponent implements OnInit {
  @Input() saveMode = 'POST';
  @Input() countType: CountType = new CountType().deserialize({});
  @Output() RefreshTable = new EventEmitter<any>();
  @Output() CountTypeAdded = new EventEmitter<CountType>();

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
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {}

  AddCountType() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'CountTypes';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.countType.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `CountTypes(${this.countType.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.countType, true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          const newCountType = new CountType().deserialize(res);
          this.CountTypeAdded.emit(newCountType);
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
    if (!this.countType.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
  }
}
