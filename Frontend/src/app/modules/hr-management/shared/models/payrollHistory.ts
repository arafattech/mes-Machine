import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Employee } from '@shared/model/employee';

export class PayrollHistory implements Deserializable {
  id?: number;
  start_date?: string = '';
  end_date?: string = '';
  total_employees?: number = 0;
  payment_method?: string = '';
  total_salary?: number = 0;
  total_tax?: number = 0;
  total_bonus?: number = 0;
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
