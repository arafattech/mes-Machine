import { Deserializable } from '@app/shared/interfaces/deserializable';

export class SaleOrderItem implements Deserializable {
  id?: number;
  sale_order_id?: number;
  product_id?: number;
  quantity?: number = 0;
  minimum_unit_price?: number = 0;
  unit_price?: number = 0;
  total_price?: number = 0;
  status?: string = 'PENDING';
  discount?: number = 0;
  discount_type?: string = '';
  discount_amount?: number = 0;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      created_at: undefined,
      updated_at: undefined,
      deleted_at: undefined,
    };
  }
}
