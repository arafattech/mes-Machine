import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { ProductType } from "@shared/model/productType";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import ValueState from "@ui5/webcomponents-base/dist/types/ValueState.js";
import { ToastService } from "@app/services/toast-service/toast.service";

@Component({
  selector: "app-product-form",
  templateUrl: "./product-form.component.html",
  styleUrl: "./product-form.component.scss",
})
export class ProductFormComponent {
  @Input() saveMode = "POST";
  @Input() productType: ProductType = new ProductType().deserialize({});
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() RefreshTable = new EventEmitter<any>();
  @Output() TypeAdded = new EventEmitter<ProductType>();

  open: boolean = false;
  loading: boolean = false;
  ToastType: "add" | "edit" | "error" = "add";
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
    let url = "";
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = "ProductTypes";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.productType.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `ProductTypes(${this.productType.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.productType.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          const newType = new ProductType().deserialize(res);
          this.TypeAdded.emit(newType);
          this.CloseDialog();
          this.RefreshTable.emit();
          this.toastService.show(this.ToastType);
        },
        error: (error: any) => {
          this.open = false;
          this.CloseDialog();
          this.toastService.show("error");
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
    if (!this.productType.name) {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.valueStateOptions.name = ValueState.None;
    this.productType = new ProductType().deserialize({});
  }
}
