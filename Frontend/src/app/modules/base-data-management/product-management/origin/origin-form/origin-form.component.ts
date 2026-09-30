import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@shared/enums/saveMode';
import { Origin } from '@shared/model/origin';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';

@Component({
  selector: 'app-origin-form',
  templateUrl: './origin-form.component.html',
})
export class OriginFormComponent {
  @Input() saveMode = saveMode.POST;
  @Input() origin: Origin = new Origin().deserialize({});
  @Output() RefreshTable = new EventEmitter<void>();
  open = false;
  loading = false;
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  valueStateOptions = { name: ValueState.None };

  constructor(private commonService: CommonService, private toastService: ToastService) {}

  onSave(): void {
    if (!this.origin.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      return;
    }

    this.loading = true;
    const request$ = this.saveMode === saveMode.POST
      ? this.commonService.post('Origins', this.origin.toOdata(), true)
      : this.commonService.put(`Origins(${this.origin.id})`, this.origin.toOdata(), true);

    request$.subscribe({
      next: () => {
        this.toastService.show(this.saveMode === saveMode.POST ? 'add' : 'edit');
        this.RefreshTable.emit();
        this.closeDialog();
      },
      error: () => {
        this.loading = false;
        this.toastService.show('error');
      },
    });
  }

  checkValidation(event: any): void {
    this.valueStateOptions.name = event.target.value?.trim() ? ValueState.None : ValueState.Negative;
  }

  closeDialog(): void {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.origin = new Origin().deserialize({});
  }
}
