import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ApprovalType } from '@shared/model/approvalType';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';

@Component({
  selector: 'app-approver-type-form',
  templateUrl: './approver-type-form.component.html',
  styleUrl: './approver-type-form.component.scss',
})
export class ApproverTypeFormComponent {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Input() saveMode: string = saveMode.POST;
  @Input() approvalType: ApprovalType = new ApprovalType().deserialize({});
  @Output() refreshTable = new EventEmitter<void>();

  loading = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  public validationMessage = Localization.requiredField;
  public localization = Localization;
  valueStateOptions = { name: ValueState.None };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  save() {
    if (!this.validateForm()) return;

    this.loading = true;
    let request$;

    if (this.saveMode === saveMode.POST) {
      this.ToastType = 'add';
      request$ = this.commonService.post('ApprovalTypes', this.approvalType.toOdata(), true);
    } else {
      this.ToastType = 'edit';
      request$ = this.commonService.put(
        `ApprovalTypes(${this.approvalType.id})`,
        this.approvalType.toOdata(),
        true,
      );
    }

    request$.subscribe({
      next: () => {
        this.refreshTable.emit();
        this.toastService.show(this.ToastType);
        this.closeDialog();
      },
      error: () => {
        this.toastService.show('error');
        this.closeDialog();
      },
    });
  }

  onCodeInput(event: any) {
    const input = event.target;
    const cursorPosition = input.selectionStart;
    const uppercased = (input.value ?? '').toUpperCase();
    this.approvalType.code = uppercased;
    input.value = uppercased;
    input.setSelectionRange?.(cursorPosition, cursorPosition);
  }

  checkValidation(event: any) {
    const value = event.target.value ?? '';
    this.valueStateOptions.name = value.trim() ? ValueState.None : ValueState.Negative;
  }

  validateForm(): boolean {
    if (!this.approvalType.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      return false;
    }
    return true;
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.openChange.emit(false);
    this.valueStateOptions.name = ValueState.None;
  }
}
