import { Deserializable } from '@app/shared/interfaces/deserializable';

export class EmployeeGroup implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  is_permanent?: boolean = false;
  shift_id?: number | null = null;
  name?: string = '';
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
