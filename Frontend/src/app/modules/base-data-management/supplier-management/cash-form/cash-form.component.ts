import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SupplierBankInfo } from '@shared/model/supplier-bank-info';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import ValueState from '@ui5/webcomponents-base/dist/types/ValueState.js';

@Component({
  selector: 'app-cash-form',
  templateUrl: './cash-form.component.html',
})
export class CashFormComponent {
  @Input() open: boolean = false;
  @Input() saveCashMode: saveMode = saveMode.POST;
  @Input() loading: boolean = false;
  @Input() SupplierBankInfo: SupplierBankInfo = new SupplierBankInfo();
  @Output() submitCash = new EventEmitter<void>();
  @Output() cancelCash = new EventEmitter<void>();
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public localization = Localization;
  valueStateOptionsCash = {
    amount: ValueState.None,
    payment_date: ValueState.None,
  };

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : '';

    switch (field) {
      case 'amount':
        if (!value.trim()) {
          this.valueStateOptionsCash.amount = ValueState.Negative;
        } else {
          this.SupplierBankInfo.amount = value;
          this.valueStateOptionsCash.amount = ValueState.None;
        }
        break;

      case 'payment_date':
        if (!value.trim()) {
          this.valueStateOptionsCash.payment_date = ValueState.Negative;
        } else {
          this.SupplierBankInfo.payment_date = value;
          this.valueStateOptionsCash.payment_date = ValueState.None;
        }
        break;

      case 'additional_notes':
        this.SupplierBankInfo.additional_notes = value;
        break;

      default:
        break;
    }
  }

  validateCashForm(): boolean {
    let isValid = true;

    if (!String(this.SupplierBankInfo.amount ?? '').trim()) {
      this.valueStateOptionsCash.amount = ValueState.Negative;
      isValid = false;
    }
    if (!this.SupplierBankInfo.payment_date?.trim()) {
      this.valueStateOptionsCash.payment_date = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  onSubmit() {
    if (!this.validateCashForm()) {
      return;
    }
    this.submitCash.emit();
  }

  onCancel() {
    this.valueStateOptionsCash = {
      amount: ValueState.None,
      payment_date: ValueState.None,
    };
    this.cancelCash.emit();
  }
}