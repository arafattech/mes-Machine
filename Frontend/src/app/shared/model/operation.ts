import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Product } from '@app/shared/model/product';

export class Operation implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  custom_id?: string;
  operation_name: string = '';
  standard_cycle_time?: number;
  item_id?: number;
  created_at?: string;
  updated_at?: string;
  products?: Product[];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      products: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
