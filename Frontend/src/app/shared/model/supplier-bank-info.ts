import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Supplier } from '@app/shared/model/supplier';
import { User } from '@app/shared/model/user';

export class SupplierBankInfo implements Deserializable {
  id?: number;
  supplier_id?: number;
  is_active?: boolean = false;
  bank_name?: string = '';
  account_holder_name?: string = '';
  account_number?: string = '';
  account_type?: string = '';
  branch_name?: string = '';
  branch_address?: string = '';
  routing_number?: string = '';
  swift_code?: string = '';
  currency?: string = '';
  country?: string = '';
  additional_notes?: string = '';
  amount?: string = '';
  payment_date?: string = '';
  mode_of_payment?: string = '';
  format_of_payment?: string = '';
  approved_by?: number;
  created_by?: number;
  approved_at?: string;
  created_at?: string;
  updated_at?: string;
  Supplier?: Supplier;
  createdBy?: User;
  user?: User;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }

    switch (input.mode_of_payment) {
      case 'CASH':
        this.format_of_payment = 'Cash';
        break;
      case 'BANK_TRANSFER':
        this.format_of_payment = 'Bank Transfer';
        break;
      default:
    }

    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      is_active: this.is_active !== undefined ? this.is_active : true,
      created_by: JSON.parse(localStorage.getItem('userInfo') || '{}').id,
      Supplier: undefined,
      format_of_payment: undefined,
      supplier: undefined,
      user: undefined,
      User: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
