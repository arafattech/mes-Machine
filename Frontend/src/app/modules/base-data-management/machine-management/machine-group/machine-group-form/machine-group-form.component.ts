import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';
import { MachineGroup } from '@shared/model/machineGroup';

@Component({
  selector: 'app-machine-group-form',
  templateUrl: './machine-group-form.component.html',
  styleUrl: './machine-group-form.component.scss',
})
export class MachineGroupFormComponent {
  @Input() saveMode = 'POST';
  @Input() machineGroup: MachineGroup = new MachineGroup().deserialize({});
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() RefreshTable = new EventEmitter<any>();
  @Output() groupAdded = new EventEmitter<MachineGroup>();
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

  AddGroup() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'MachineGroups';
      this.ToastType = 'add';
      request$ = this.commonService.post(
        url,
        this.machineGroup.toOdata(),
        true
      );
    } else if (this.saveMode === saveMode.PUT) {
      url = `MachineGroups(${this.machineGroup.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.machineGroup.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          const newGroup = new MachineGroup().deserialize(res);
          this.groupAdded.emit(newGroup);
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
    if (!this.machineGroup.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.machineGroup = new MachineGroup().deserialize({});
  }
}
