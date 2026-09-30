import { Deserializable } from '@shared/interfaces/deserializable';
import { Machine } from '@shared/model/machine';
import { Product } from '@shared/model/product';

export class OperationPosition implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  custom_id?: string;
  name: string = '';
  operation_id?: number;
  product_id?: number;
  machine_id?: number;
  created_at?: string;
  updated_at?: string;
  products?: Product[];
  machines?: Machine[];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      operation_name: undefined,
      products: undefined,
      machines: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
