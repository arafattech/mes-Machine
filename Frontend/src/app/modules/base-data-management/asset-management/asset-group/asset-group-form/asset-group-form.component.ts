import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { saveMode } from '@app/shared/enums/saveMode';
import { Localization } from '@app/shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';
import { AssetGroup } from '@shared/model/assetGroup';

@Component({
  selector: 'app-asset-group-form',
  templateUrl: './asset-group-form.component.html',
  styleUrl: './asset-group-form.component.scss',
})
export class AssetGroupFormComponent {
  @Input() saveMode = 'POST';
  assetGroup = new AssetGroup();
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

  addAssetGroup() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'AssetGroups';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.assetGroup.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `AssetGroups(${this.assetGroup.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.assetGroup.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          this.CloseDialog();
          this.RefreshTable.emit();
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
    if (!this.assetGroup.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.assetGroup = new AssetGroup().deserialize({});
  }
}
