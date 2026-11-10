import { Component, EventEmitter, Input, Output } from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { saveMode } from "@shared/enums/saveMode";
import { Operation } from "@shared/model/operation";
import { Product } from "@shared/model/product";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";

@Component({
  selector: "app-operation-management-form",
  templateUrl: "./operation-management-form.component.html",
  styleUrl: "./operation-management-form.component.scss",
})
export class OperationManagementFormComponent {
  @Input() saveMode = "POST";
  @Input() operations: Operation = new Operation();
  @Output() RefreshTable = new EventEmitter<any>();
  open: boolean = false;
  loading: boolean = false;
  ToastType: "add" | "edit" | "error" = "add";
  public validationMessage = Localization.requiredField;
  public cycleTimeMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  public productTitle = "";
  valueStateOptions = {
    operation_name: ValueState.None,
    standard_cycle_time: ValueState.None,
    product_selection: ValueState.None,
  };
  products: Product[] = [];
  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {}
  ngOnInit() {
    this.getProducts();
  }
  saveOperation() {
    if (!this.validateForm()) {
      return;
    }
    this.loading = true;
    let url = "";
    let request$;
    if (this.saveMode === saveMode.POST) {
      url = "Operations";
      this.ToastType = "add";
      request$ = this.commonService.post(url, this.operations.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Operations(${this.operations.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, this.operations.toOdata(), true);
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
          this.toastService.show("error");
        },
      });
    }
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "name":
        if (!value.trim()) {
          this.valueStateOptions.operation_name = ValueState.Negative;
        } else {
          this.operations.operation_name = value;
          this.valueStateOptions.operation_name = ValueState.None;
        }
        break;

      case "cycle":
        if (this.validateCycleTime(value)) {
          this.operations.standard_cycle_time = value;
        }
        break;
      case "product":
        if (!value.trim()) {
          this.valueStateOptions.product_selection = ValueState.Negative;
        } else {
          this.valueStateOptions.product_selection = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;
    if (this.operations.operation_name?.trim()) {
      this.valueStateOptions.operation_name = ValueState.None;
    } else {
      this.valueStateOptions.operation_name = ValueState.Negative;
      isValid = false;
    }
    if (!this.validateCycleTime(this.operations.standard_cycle_time)) {
      isValid = false;
    }
    if (this.operations.item_id) {
      this.valueStateOptions.product_selection = ValueState.None;
    } else {
      this.valueStateOptions.product_selection = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }
  private validateCycleTime(value: string | number | null | undefined): boolean {
    const isBlank = value === null || value === undefined || String(value).trim() === "";
    const isNegative = !isBlank && Number(value) < 0;
    this.cycleTimeMessage = isNegative
      ? $localize`Cycle time cannot be negative.`
      : Localization.requiredField;
    const isValid = !isBlank && !isNegative;
    this.valueStateOptions.standard_cycle_time = isValid
      ? ValueState.None
      : ValueState.Negative;
    return isValid;
  }

  SelctedProduct(data: any) {
    this.operations.item_id = data.detail.item.id;
    this.productTitle = data.detail.item.text;
    this.checkValidation({ target: { value: this.productTitle } }, "product");
  }
  getProducts() {
    this.loading = true;
    let url = "Products?$orderby=id desc&$filter=is_active eq true";
    const request$ = this.commonService.get(url, true);
    request$.subscribe({
      next: (res: any) => {
        this.products = res.value;
        this.loading = false;
      },
    });
  }
  resetForm() {
    this.operations = new Operation().deserialize({});
    this.valueStateOptions.operation_name = ValueState.None;
    this.valueStateOptions.standard_cycle_time = ValueState.None;
    this.valueStateOptions.product_selection = ValueState.None;
  }

  CloseDialog() {
    this.open = false;
    this.loading = false;
    this.resetForm();
    this.productTitle = "";
  }
}
