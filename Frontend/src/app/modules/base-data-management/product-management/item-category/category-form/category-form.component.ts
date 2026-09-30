import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ItemCategory } from '@shared/model/itemCategory';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { ToastService } from '@app/services/toast-service/toast.service';

@Component({
  selector: 'app-category-form',
  templateUrl: './category-form.component.html',
  styleUrl: './category-form.component.scss',
})
export class CategoryFormComponent implements OnInit {
  @Input() saveMode = 'POST';
  @Input() itemCategory: ItemCategory = new ItemCategory().deserialize({});
  @Output() RefreshTable = new EventEmitter<any>();
  @Output() CatAdded = new EventEmitter<ItemCategory>();

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

  ngOnInit(): void {}

  AddItemCategory() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'ItemCategories';
      this.ToastType = 'add';
      request$ = this.commonService.post(
        url,
        this.itemCategory.toOdata(),
        true
      );
    } else if (this.saveMode === saveMode.PUT) {
      url = `ItemCategories(${this.itemCategory.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.itemCategory, true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          const newCat = new ItemCategory().deserialize(res);
          this.CatAdded.emit(newCat);
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
    if (!this.itemCategory.name) {
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
