import { Deserializable } from '@app/shared/interfaces/deserializable';

export class PricePlan implements Deserializable {
  id?: number;
  product_id?: number;
  is_active?: boolean = true;
  is_default?: boolean = false;
  discount_percentage?: number = 0;
  max_qty?: number = 0;
  min_qty?: number = 0;
  plan_name?: string = '';
  price?: string = '';
  start_date?: string;
  end_date?: string;
  created_at?: string;
  updated_at?: string;

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
    };
  }
}
