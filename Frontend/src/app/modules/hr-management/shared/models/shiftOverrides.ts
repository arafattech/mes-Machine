import { Deserializable } from '@app/shared/interfaces/deserializable';

export class ShiftOverrides implements Deserializable {
  id?: number;
  shift_id?: number;
  date?: string ;
  absent_employee_id?: number | null;
  replacement_employee_id?: number | null;
  type?: 'REPLACEMENT' | 'SWAP' | 'EXTRA';
  custom_id?: string;
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
      name: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
