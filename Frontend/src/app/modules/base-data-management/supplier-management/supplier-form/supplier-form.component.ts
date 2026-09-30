import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { Supplier } from '@shared/model/supplier';
import { SupplierBankInfo } from '@shared/model/supplier-bank-info';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import ValueState from '@ui5/webcomponents-base/dist/types/ValueState.js';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ModeOfPayment } from '@shared/enums/mode-of-payment';
import { Country } from '@shared/enums/country';
import { CashFields, BankFields } from '@app/shared/utilities/staticData';
import { Origin } from '@shared/model/origin';

@Component({
  selector: 'app-supplier-form',
  templateUrl: './supplier-form.component.html',
  styleUrl: './supplier-form.component.scss',
})
export class SupplierFormComponent {
  @Input() saveMode = 'POST';
  @Output() IsDeleteCash = new EventEmitter<string>();
  @Output() IsBankDelete = new EventEmitter<string>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() supplierAdded: EventEmitter<Supplier> = new EventEmitter<Supplier>();
  open: boolean = false;
  loading: boolean = false;
  odata: boolean;
  Supplier = new Supplier();
  SupplierBankInfo = new SupplierBankInfo();
  saveCashMode: saveMode = saveMode.POST;
  saveBankMode: saveMode = saveMode.POST;
  selectedTab = 'coreData';
  ToastType: 'add' | 'edit' | 'error' = 'add';
  countries = Object.values(Country);
  ModeOfPayment = ModeOfPayment;
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  valueStateOptionsSupplier = {
    supplierID: ValueState.None,
    name: ValueState.None,
    address: ValueState.None,
    first_contact_person_phone: ValueState.None,
  };
  valueStateOptionsBank = {
    bank_name: ValueState.None,
    account_holder_name: ValueState.None,
    account_number: ValueState.None,
    account_type: ValueState.None,
    branch_name: ValueState.None,
    branch_address: ValueState.None,
    routing_number: ValueState.None,
    country: ValueState.None,
  };
  valueStateOptionsCash = {
    amount: ValueState.None,
    payment_date: ValueState.None,
  };
  bankModalOpen: boolean = false;
  cashModalOpen: boolean = false;
  editBankIndex: number | null = null;
  editCashIndex: number | null = null;
  SupplierBankInfoList: SupplierBankInfo[] = [];
  SupplierCashInfoList: SupplierBankInfo[] = [];
  cashFields = CashFields;
  bankFields = BankFields;
  origins: Origin[] = [];

  constructor(
    private commonService: CommonService,
    private toastService: ToastService
  ) {
    this.odata = this.commonService.odata;
  }

  ngOnInit(): void {
    this.commonService.get<any>('Origins?$filter=is_active eq true&$orderby=name asc', this.odata)
      .subscribe({ next: (res) => this.origins = res.value ?? [] });
  }

  onOriginChange(event: any): void {
    const selectedItem = event?.detail?.item;
    this.Supplier.origin_id = selectedItem?.id ? Number(selectedItem.id) : null;
  }

  get originName(): string {
    return this.origins.find((origin) => origin.id === this.Supplier.origin_id)?.name ?? '';
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : '';

    switch (field) {
      case 'supplierID':
        if (!value.trim()) {
          this.valueStateOptionsSupplier.supplierID = ValueState.Negative;
        } else {
          this.Supplier.supplierID = value;
          this.valueStateOptionsSupplier.supplierID = ValueState.None;
        }
        break;

      case 'name':
        if (!value.trim()) {
          this.valueStateOptionsSupplier.name = ValueState.Negative;
        } else {
          this.Supplier.name = value;
          this.valueStateOptionsSupplier.name = ValueState.None;
        }
        break;

      case 'address':
        if (!value.trim()) {
          this.valueStateOptionsSupplier.address = ValueState.Negative;
        } else {
          this.Supplier.address = value;
          this.valueStateOptionsSupplier.address = ValueState.None;
        }
        break;

      case 'first_contact_person_phone':
        if (!value.trim()) {
          this.valueStateOptionsSupplier.first_contact_person_phone =
            ValueState.Negative;
        } else {
          this.Supplier.first_contact_person_phone = value;
          this.valueStateOptionsSupplier.first_contact_person_phone =
            ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateSupplierForm(): boolean {
    let isValid = true;

    if (!this.Supplier.supplierID?.trim()) {
      this.valueStateOptionsSupplier.supplierID = ValueState.Negative;
      isValid = false;
    }
    if (!this.Supplier.name?.trim()) {
      this.valueStateOptionsSupplier.name = ValueState.Negative;
      isValid = false;
    }
    if (!this.Supplier.address?.trim()) {
      this.valueStateOptionsSupplier.address = ValueState.Negative;
      isValid = false;
    }
    if (!String(this.Supplier.first_contact_person_phone ?? '').trim()) {
      this.valueStateOptionsSupplier.first_contact_person_phone =
        ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  saveSupplier() {
    if (!this.validateSupplierForm()) {
      this.selectedTab = 'coreData';
      return;
    }

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'Suppliers';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.Supplier.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Suppliers(${this.Supplier.id})`;
      this.ToastType = 'edit';
      request$ = this.commonService.put(url, this.Supplier.toOdata(), true);
    }

    if (request$) {
      request$.subscribe({
        next: (res: any) => {
          const supplierId = res.id || this.Supplier.id;
          if (this.saveMode === saveMode.POST) {
            this.savePaymentInfo(supplierId, 'CASH');
            this.savePaymentInfo(supplierId, 'BANK');
            this.supplierAdded.emit(
              new Supplier().deserialize({ ...this.Supplier, ...res }),
            );
          }
          this.CloseDialog();
          this.toastService.show(this.ToastType);
          this.refreshTable.emit();
        },
        error: () => {
          this.toastService.show('error');
          this.loading = false;
        },
      });
    }
  }

  savePaymentInfo(supplierId?: number, type?: 'CASH' | 'BANK') {
    const infoList = type === 'CASH' ? this.SupplierCashInfoList : this.SupplierBankInfoList;
    const batchPayload = {
      requests: infoList.map((info, index) => ({
        id: index + 1,
        method: saveMode.POST,
        url: info.id
          ? `/odata/SupplierBankInfos(${info.id})`
          : `/odata/SupplierBankInfos`,
        headers: { 'Content-Type': 'application/json' },
        body: {
          ...info.toOdata(),
          supplier_id: supplierId,
          mode_of_payment:
            type === 'CASH' ? ModeOfPayment.CASH : ModeOfPayment.BANK_TRANSFER,
        },
      })),
    };

    this.commonService.post('$batch', batchPayload, true).subscribe({
      next: () => {
        this.handleSuccess();
        this.loading = false;
      },
      error: () => {
        this.toastService.show('error');
        this.loading = false;
      },
    });
  }

  private getApiUrlAndMethod(
    type: 'CASH' | 'BANK',
    saveModeType: 'POST' | 'PUT',
    id?: number
  ): { apiUrl: string; apiMethod: 'post' | 'put' } {
    const apiUrl =
      saveModeType === 'POST'
        ? 'SupplierBankInfos'
        : `SupplierBankInfos(${id})`;
    const apiMethod = saveModeType === 'POST' ? 'post' : 'put';
    return { apiUrl, apiMethod };
  }

  private getPayload(type: 'CASH' | 'BANK') {
    return {
      ...this.SupplierBankInfo.toOdata(),
      supplier_id: this.Supplier.id,
      mode_of_payment:
        type === 'CASH' ? ModeOfPayment.CASH : ModeOfPayment.BANK_TRANSFER,
    };
  }

  private saveToList(type: 'CASH' | 'BANK') {
    if (type === 'CASH') {
      if (this.saveCashMode === 'POST') {
        this.SupplierCashInfoList.push(this.SupplierBankInfo);
      } else if (this.saveCashMode === 'PUT') {
        this.SupplierCashInfoList[this.editCashIndex!] = this.SupplierBankInfo;
      }
    } else {
      if (this.saveBankMode === 'POST') {
        this.SupplierBankInfoList.push(this.SupplierBankInfo);
      } else if (this.saveBankMode === 'PUT') {
        this.SupplierBankInfoList[this.editBankIndex!] = this.SupplierBankInfo;
      }
    }
    this.cashModalOpen = false;
    this.bankModalOpen = false;
  }

  private callApi(
    apiUrl: string,
    apiMethod: 'post' | 'put',
    payload: any,
    type: 'CASH' | 'BANK'
  ) {
    const request =
      apiMethod === 'post'
        ? this.commonService.post(apiUrl, payload, true)
        : this.commonService.put(apiUrl, payload, true);

    request.subscribe({
      next: () => {
        this.loading = false;
        this.toastService.show(apiMethod === 'post' ? 'add' : 'edit');
        this.cashModalOpen = false;
        this.bankModalOpen = false;
        this.getCashAndBankInfo(type);
      },
      error: (error) => {
        this.loading = false;
        console.error(`Failed to ${apiMethod} ${type} info:`, error);
      },
    });
  }

  submitCashAndBankInfo(type: 'CASH' | 'BANK') {
    this.loading = true;
    if (this.saveMode === 'POST') {
      this.saveToList(type);
      this.loading = false;
      return;
    }

    const saveModeType = type === 'CASH' ? this.saveCashMode : this.saveBankMode;
    const { apiUrl, apiMethod } = this.getApiUrlAndMethod(
      type,
      saveModeType as 'POST' | 'PUT',
      this.SupplierBankInfo.id
    );
    const payload = this.getPayload(type);

    this.callApi(apiUrl, apiMethod, payload, type);
  }

  getCashAndBankInfo(type: 'CASH' | 'BANK') {
    const mode = type === 'CASH' ? ModeOfPayment.CASH : ModeOfPayment.BANK_TRANSFER;
    const url = `SupplierBankInfos?$filter=supplier_id eq ${this.Supplier.id} and mode_of_payment eq '${mode}'`;

    this.commonService.get(url).subscribe({
      next: (res: any) => {
        if (type === 'CASH') {
          this.SupplierCashInfoList = (res.value || []).map((item: any) =>
            new SupplierBankInfo().deserialize(item)
          );
        } else if (type === 'BANK') {
          this.SupplierBankInfoList = (res.value || []).map((item: any) =>
            new SupplierBankInfo().deserialize(item)
          );
        }
      },
      error: (error: any) => {
        console.error('error');
      },
    });
  }

  private handleSuccess() {
    this.toastService.show(this.ToastType);
    this.loading = false;
  }

  onTabSelect(event: any) {
    this.selectedTab = event.detail.tab.id;
  }

  openBankModal(): void {
    this.saveBankMode = saveMode.POST;
    this.editBankIndex = null;
    this.SupplierBankInfo = new SupplierBankInfo().deserialize({});
    this.bankModalOpen = true;
  }

  openCashModal(): void {
    this.saveCashMode = saveMode.POST;
    this.SupplierBankInfo = new SupplierBankInfo();
    this.editCashIndex = null;
    this.cashModalOpen = true;
  }

  editCash(data: any) {
    this.saveCashMode = saveMode.PUT;
    this.SupplierBankInfo = data[0];
    this.editCashIndex = data[1];
    this.cashModalOpen = true;
  }

  editBank(data: any) {
    this.saveBankMode = saveMode.PUT;
    this.SupplierBankInfo = data[0];
    this.editBankIndex = data[1];
    this.bankModalOpen = true;
  }

  cancelCash() {
    this.cashModalOpen = false;
    this.resetCash();
  }

  cancelBank() {
    this.bankModalOpen = false;
    this.resetBank();
  }

  resetForm(): void {
    this.Supplier = new Supplier().deserialize({});
    this.SupplierBankInfo = new SupplierBankInfo();
    this.SupplierCashInfoList = [];
    this.SupplierBankInfoList = [];
    this.editBankIndex = null;
    this.editCashIndex = null;
    this.selectedTab = 'coreData';
    this.saveMode = saveMode.POST;
    this.bankModalOpen = false;
    this.cashModalOpen = false;
    this.valueStateOptionsSupplier = {
      supplierID: ValueState.None,
      name: ValueState.None,
      address: ValueState.None,
      first_contact_person_phone: ValueState.None,
    };
  }

  resetBank() {
    this.valueStateOptionsBank = {
      bank_name: ValueState.None,
      account_holder_name: ValueState.None,
      account_number: ValueState.None,
      account_type: ValueState.None,
      branch_name: ValueState.None,
      branch_address: ValueState.None,
      routing_number: ValueState.None,
      country: ValueState.None,
    };
  }

  resetCash() {
    this.valueStateOptionsCash = {
      amount: ValueState.None,
      payment_date: ValueState.None,
    };
  }

  CloseDialog(): void {
    this.open = false;
    this.loading = false;
    this.resetForm();
    this.resetBank();
    this.resetCash();
  }
}
