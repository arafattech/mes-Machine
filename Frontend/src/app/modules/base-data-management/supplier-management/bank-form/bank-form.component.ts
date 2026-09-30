import { Component, EventEmitter, Input, Output } from '@angular/core';
import { SupplierBankInfo } from '@shared/model/supplier-bank-info';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import ValueState from '@ui5/webcomponents-base/dist/types/ValueState.js';
import { Country } from '@shared/enums/country';

@Component({
  selector: 'app-bank-form',
  templateUrl: './bank-form.component.html',
})
export class BankFormComponent {
  @Input() open: boolean = false;
  @Input() saveBankMode: saveMode = saveMode.POST;
  @Input() loading: boolean = false;
  @Input() SupplierBankInfo: SupplierBankInfo = new SupplierBankInfo();
  @Output() submitBank = new EventEmitter<void>();
  @Output() cancelBank = new EventEmitter<void>();
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public localization = Localization;
  countries = Object.values(Country);
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

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : '';

    switch (field) {
      case 'bank_name':
        if (!value.trim()) {
          this.valueStateOptionsBank.bank_name = ValueState.Negative;
        } else {
          this.SupplierBankInfo.bank_name = value;
          this.valueStateOptionsBank.bank_name = ValueState.None;
        }
        break;

      case 'account_holder_name':
        if (!value.trim()) {
          this.valueStateOptionsBank.account_holder_name = ValueState.Negative;
        } else {
          this.SupplierBankInfo.account_holder_name = value;
          this.valueStateOptionsBank.account_holder_name = ValueState.None;
        }
        break;

      case 'account_number':
        if (!value.trim()) {
          this.valueStateOptionsBank.account_number = ValueState.Negative;
        } else {
          this.SupplierBankInfo.account_number = value;
          this.valueStateOptionsBank.account_number = ValueState.None;
        }
        break;

      case 'account_type':
        if (!value.trim()) {
          this.valueStateOptionsBank.account_type = ValueState.Negative;
        } else {
          this.SupplierBankInfo.account_type = value;
          this.valueStateOptionsBank.account_type = ValueState.None;
        }
        break;

      case 'branch_name':
        if (!value.trim()) {
          this.valueStateOptionsBank.branch_name = ValueState.Negative;
        } else {
          this.SupplierBankInfo.branch_name = value;
          this.valueStateOptionsBank.branch_name = ValueState.None;
        }
        break;

      case 'routing_number':
        if (!value.trim()) {
          this.valueStateOptionsBank.routing_number = ValueState.Negative;
        } else {
          this.SupplierBankInfo.routing_number = value;
          this.valueStateOptionsBank.routing_number = ValueState.None;
        }
        break;

      case 'country':
        if (!value.trim()) {
          this.valueStateOptionsBank.country = ValueState.Negative;
        } else {
          this.SupplierBankInfo.country = value;
          this.valueStateOptionsBank.country = ValueState.None;
        }
        break;

      case 'branch_address':
        if (!value.trim()) {
          this.valueStateOptionsBank.branch_address = ValueState.Negative;
        } else {
          this.SupplierBankInfo.branch_address = value;
          this.valueStateOptionsBank.branch_address = ValueState.None;
        }
        break;

      default:
        break;
    }
  }

  validateBankForm(): boolean {
    let isValid = true;

    if (!this.SupplierBankInfo.bank_name?.trim()) {
      this.valueStateOptionsBank.bank_name = ValueState.Negative;
      isValid = false;
    }
    if (!this.SupplierBankInfo.account_holder_name?.trim()) {
      this.valueStateOptionsBank.account_holder_name = ValueState.Negative;
      isValid = false;
    }
    if (!this.SupplierBankInfo.account_number?.trim()) {
      this.valueStateOptionsBank.account_number = ValueState.Negative;
      isValid = false;
    }
    if (!this.SupplierBankInfo.account_type?.trim()) {
      this.valueStateOptionsBank.account_type = ValueState.Negative;
      isValid = false;
    }
    if (!this.SupplierBankInfo.branch_name?.trim()) {
      this.valueStateOptionsBank.branch_name = ValueState.Negative;
      isValid = false;
    }
    if (!this.SupplierBankInfo.routing_number?.trim()) {
      this.valueStateOptionsBank.routing_number = ValueState.Negative;
      isValid = false;
    }
    if (!this.SupplierBankInfo.country?.trim()) {
      this.valueStateOptionsBank.country = ValueState.Negative;
      isValid = false;
    }
    if (!this.SupplierBankInfo.branch_address?.trim()) {
      this.valueStateOptionsBank.branch_address = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  onSubmit() {
    if (!this.validateBankForm()) {
      return;
    }
    this.submitBank.emit();
  }

  onCancel() {
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
    this.cancelBank.emit();
  }
}
