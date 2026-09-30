import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { saveMode } from '@shared/enums/saveMode';
import { Machine } from '@shared/model/machine';
import { OperationPosition } from '@shared/model/oparationPosition';
import { Product } from '@shared/model/product';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
@Component({
  selector: 'app-operation-management-info-form',
  templateUrl: './operation-management-info-form.component.html',
  styleUrl: './operation-management-info-form.component.scss',
})
export class OperationManagementInfoFormComponent {
  @Input() saveMode = 'POST';
  operationPosition: OperationPosition = new OperationPosition();
  @Output() RefreshTable = new EventEmitter<any>();
  product: Product = new Product();
  machine: Machine = new Machine();
  products: Product[] = [];
  machines: Machine[] = [];
  selectedProductId: number | null = null;
  selectedMachineId: number | null = null;
  operationId: number | null = null;
  open: boolean = false;
  loading: boolean = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  public productTitle: string = '';
  public machineTitle: string = '';
  valueStateOptions = {
    operation_name: ValueState.None,
    product_selection: ValueState.None,
    machine_selection: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.getProducts();
    this.getMachines();
  }

  saveOperationInfo(): void {
    if (!this.validateForm()) {
      return;
    }
    this.loading = true;
    let url = '';
    let request$;
    if (this.saveMode === saveMode.POST) {
      url = 'OperationPositions';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.operationPosition.toOdata());
    } else if (this.saveMode === saveMode.PUT) {
      url = `OperationPositions(${this.operationPosition.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.operationPosition.toOdata());
    }
    if (request$) {
      request$.subscribe({
        next: (res) => {
          this.CloseDialog();
          this.RefreshTable.emit();
          this.toastService.show(this.ToastType);
          this.cdr.detectChanges();
        },
        error: (error: any) => {
          this.CloseDialog();
          console.error('Error', error);
          this.toastService.show('error');
          this.cdr.detectChanges();
        },
      });
    }
  }

  getProducts(): void {
    this.loading = true;
    this.commonService.get(`Products?$orderby=id desc&$filter=is_active eq true`, true).subscribe({
      next: (res: any) => {
        this.products = res.value;
        this.loading = false;
      },
    });
  }
  SelctedProduct(data: any) {
    const selectedId = Number(data.detail.item.id);
    this.operationPosition.product_id = selectedId;
    this.selectedProductId = selectedId;
    this.productTitle = data.detail.item.text;
    this.checkValidation({ target: { value: this.productTitle } }, 'product');
  }
  getMachines(): void {
    this.loading = true;
    this.commonService.get(`Machines?$orderby=id desc&$filter=is_active eq true`, true).subscribe({
      next: (res: any) => {
        this.machines = res.value;
        this.loading = false;
      },
    });
  }
  SelctedMachine(data: any) {
    const selectedId = Number(data.detail.item.id);
    this.operationPosition.machine_id = selectedId;
    this.selectedMachineId = selectedId;
    this.machineTitle = data.detail.item.text;
    this.checkValidation({ target: { value: this.machineTitle } }, 'machine');
  }

  checkValidation(event: any, field: string): void {
    const value = event.target?.value ?? event.detail?.item?.id;

    switch (field) {
      case 'name':
        if (!value?.trim()) {
          this.valueStateOptions.operation_name = ValueState.Negative;
        } else {
          this.operationPosition.name = value;
          this.valueStateOptions.operation_name = ValueState.None;
        }
        break;
      case 'product':
        if (!value?.trim()) {
          this.valueStateOptions.product_selection = ValueState.Negative;
        } else {
          this.selectedProductId = value;
          this.valueStateOptions.product_selection = ValueState.None;
        }
        break;
      case 'machine':
        if (!value?.trim()) {
          this.valueStateOptions.machine_selection = ValueState.Negative;
        } else {
          this.selectedMachineId = value;
          this.valueStateOptions.machine_selection = ValueState.None;
        }
        break;
      default:
        break;
    }
  }

  validateForm(): boolean {
    let isValid = true;

    if (this.operationPosition.name?.trim()) {
      this.valueStateOptions.operation_name = ValueState.None;
    } else {
      this.valueStateOptions.operation_name = ValueState.Negative;
      isValid = false;
    }

    if (this.selectedProductId) {
      this.valueStateOptions.product_selection = ValueState.None;
    } else {
      this.valueStateOptions.product_selection = ValueState.Negative;
      isValid = false;
    }

    if (this.selectedMachineId !== null && this.selectedMachineId !== 0) {
      this.valueStateOptions.machine_selection = ValueState.None;
    } else {
      this.valueStateOptions.machine_selection = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  getProduct(items: any): void {
    this.product = new Product().deserialize({
      id: items.detail.item.id,
      product_name: items.detail.item.text,
    });
    this.selectedProductId = this.product.id ?? null;
    this.productTitle = items.detail.item.text;
    this.checkValidation(items, 'product');
  }

  getMachine(items: any): void {
    this.machine = new Machine().deserialize({
      id: items.detail.item.id,
      machine_name: items.detail.item.text,
    });
    this.selectedMachineId = this.machine.id ?? null;
    this.machineTitle = items.detail.item.text;
    this.checkValidation(items, 'machine');
  }
  resetForm(): void {
    this.operationPosition = new OperationPosition();
    this.product = new Product();
    this.machine = new Machine();
    this.selectedProductId = null;
    this.selectedMachineId = null;
    this.productTitle = '';
    this.machineTitle = '';
    this.valueStateOptions = {
      operation_name: ValueState.None,
      product_selection: ValueState.None,
      machine_selection: ValueState.None,
    };
  }

  CloseDialog(): void {
    this.open = false;
    this.loading = false;
    this.resetForm();
  }
}
