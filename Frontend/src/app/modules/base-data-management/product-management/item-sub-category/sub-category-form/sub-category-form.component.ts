import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ItemCategory } from '@shared/model/itemCategory';
import { ItemSubCategory } from '@shared/model/itemSubCategory';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { CategoryFormComponent } from '@base-data-module/product-management/item-category/category-form/category-form.component';

@Component({
  selector: 'app-sub-category-form',
  templateUrl: './sub-category-form.component.html',
  styleUrl: './sub-category-form.component.scss',
})
export class SubCategoryFormComponent {
  @ViewChild('categoryForm') categoryFormRef!: CategoryFormComponent;
  @Input() saveMode = 'POST';
  @Output() RefreshTable = new EventEmitter<void>();
  ItemCategories: ItemCategory[] = [];
  open: boolean = false;
  loading: boolean = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  odata: boolean;
  selectedCategory: ItemCategory = new ItemCategory().deserialize({});
  public validationMessage = Localization.requiredField;
  public categoryTitle = '';
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  public itemSubCategory = new ItemSubCategory();
  valueStateOptions = {
    name: ValueState.None,
    category: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {
    this.odata = commonService.odata;
  }

  ngOnInit(): void {
    this.getItemCategory();
  }

  onSaveType() {
    if (!this.validateForm()) {
      return;
    }

    this.loading = true;
    let url = '';
    let request$;
    if (this.saveMode === saveMode.POST) {
      url = 'ItemSubCategories';
      this.ToastType = 'add';
      request$ = this.commonService.post(
        url,
        this.itemSubCategory.toOdata(),
        true
      );
    } else if (this.saveMode === saveMode.PUT) {
      url = `ItemSubCategories(${this.itemSubCategory.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(
        url,
        this.itemSubCategory.toOdata(),
        true
      );
    }
    if (request$) {
      request$.subscribe({
        next: (res) => {
          this.CloseDialog();
          this.RefreshTable.emit();
          this.toastService.show(this.ToastType);
        },
        error: (error: any) => {
          this.CloseDialog();
          this.toastService.show('error');
        },
      });
    }
  }

  onCategoryChange(event: any) {
    this.itemSubCategory.category_id = event.detail.item.id;
    this.categoryTitle = event.detail.item.text;
    this.checkValidation({ target: { value: this.categoryTitle } }, 'category');
  }

  getItemCategory() {
    this.commonService.get(`ItemCategories?$orderby=id desc&$filter=is_active eq true`, this.odata).subscribe({
      next: (response: any) => {
        this.ItemCategories = response.value.map((item: any) =>
          new ItemCategory().deserialize(item)
        );
      },
      error: (err) => {
        console.error('Sub-category error',err);
      },
    });
  }

  checkValidation(event: any, type?: string) {
    const value = event.target.value;
    switch (type) {
      case 'name':
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.valueStateOptions.name = ValueState.None;
        }
        break;
      case 'category':
        if (!value.trim()) {
          this.valueStateOptions.category = ValueState.Negative;
        } else {
          this.valueStateOptions.category = ValueState.None;
        }
        break;
      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (!this.itemSubCategory.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    if (!this.itemSubCategory.category_id) {
      this.valueStateOptions.category = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.itemSubCategory = new ItemSubCategory().deserialize({});
    this.categoryTitle = '';
  }
}
