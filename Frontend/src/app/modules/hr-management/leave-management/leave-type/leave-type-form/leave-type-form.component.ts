import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { LeaveType } from '@app/shared/model/leaveType';
import { saveMode } from '@app/shared/enums/saveMode';
import { Localization } from '@app/shared/utilities/localization';
import { ValueState } from '@app/shared/utilities/value-state-wrapper';

@Component({
  selector: 'app-leave-type-form',
  templateUrl: './leave-type-form.component.html',
  styleUrl: './leave-type-form.component.scss',
})
export class LeaveTypeFormComponent implements OnInit {
  @Input() saveMode = 'POST';
  @Input() leaveType: LeaveType = new LeaveType().deserialize({});
  @Output() RefreshTable = new EventEmitter<any>();

  open = false;
  loading = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  public validationMessage = Localization.requiredField;
  public localization = Localization;
  approvalTypes: any[] = [];
  valueStateOptions = {
    name: ValueState.None,
    max_days: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  ngOnInit(): void {
    this.fetchApprovalTypes();
  }

  fetchApprovalTypes() {
    this.commonService.get('ApprovalTypes', true).subscribe({
      next: (res: any) => {
        this.approvalTypes = res.value ?? [];
      },
      error: () => {
        this.approvalTypes = [];
      },
    });
  }

  onApprovalTypeChange(event: any) {
    const selectedItem = event.detail.item;
    this.leaveType.approval_type_id = selectedItem ? Number(selectedItem.value) : null;
  }

  getApprovalTypeName(id?: number | null): string {
    if (id == null) return '';
    const type = this.approvalTypes.find((t) => t.id === id);
    return type ? type.name : '';
  }

  save() {
    if (!this.validateForm()) return;

    this.loading = true;
    let request$;

    if (this.saveMode === saveMode.POST) {
      this.ToastType = 'add';
      request$ = this.commonService.post('LeaveTypes', this.leaveType.toOdata(), true);
    } else {
      this.ToastType = 'edit';
      request$ = this.commonService.put(
        `LeaveTypes(${this.leaveType.id})`,
        this.leaveType.toOdata(),
        true,
      );
    }

    request$.subscribe({
      next: () => {
        this.RefreshTable.emit();
        this.toastService.show(this.ToastType);
        this.closeDialog();
      },
      error: () => {
        this.toastService.show('error');
        this.loading = false;
      },
    });
  }

  checkValidation(event: any, field: 'name' | 'max_days') {
    const value = event.target.value;
    if (field === 'name') {
      this.valueStateOptions.name = value?.trim() ? ValueState.None : ValueState.Negative;
    } else if (field === 'max_days') {
      this.valueStateOptions.max_days = Number(value) > 0 ? ValueState.None : ValueState.Negative;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.leaveType.name?.trim()) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    if (!(Number(this.leaveType.max_days) > 0)) {
      this.valueStateOptions.max_days = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.valueStateOptions.max_days = ValueState.None;
  }
}
