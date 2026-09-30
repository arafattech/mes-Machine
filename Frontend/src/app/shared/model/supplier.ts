import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Product } from '@app/shared/model/product';
import { SupplierBankInfo } from '@app/shared/model/supplier-bank-info';
import { Origin } from '@app/shared/model/origin';

export class Supplier implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  name?: string = '';
  address?: string = '';
  email?: string = '';
  note?: string = '';
  supplierID?: string = '';
  first_contact_person_name?: string = '';
  first_contact_person_phone?: string = '';
  second_contact_person_name?: string = '';
  second_contact_person_phone?: string = '';
  tin?: string = '';
  bin?: string = '';
  origin_id?: number | null = null;
  origin?: Origin | null;
  supplier_id?: number;
  mode_of_payment?: string = '';
  custom_id?: string;
  created_at?: string;
  updated_at?: string;
  product?: Product[];
  bankInfo?: SupplierBankInfo;
  bankInfos: SupplierBankInfo[] = [];
  supplierBanks: SupplierBankInfo[] = [];
  supplierCash: SupplierBankInfo[] = [];

   deserialize(input: any): this {
    Object.assign(this, input);
    this.bankInfos = input.bankInfos || [];
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      supplier_id: undefined,
      mode_of_payment: undefined,
      bankInfos: undefined,
      bankInfo: undefined,
      created_at: undefined,
      updated_at: undefined,
      supplierBanks: undefined,
      supplierCash: undefined,
      origin: undefined,
    };
  }
}
