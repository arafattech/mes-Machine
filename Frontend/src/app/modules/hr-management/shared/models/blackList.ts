import { Deserializable } from '@app/shared/interfaces/deserializable';
export class BlackList implements Deserializable {
  id?: number;
  employee_id?: number;
  is_active?: boolean = true;
  custom_id?: string;
  remarks?: string;
  added_by?: string;
  reason: string = '';
  created_at?: string;
  updated_at?: string;
  status?: boolean = false;
  revoke_reason?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    return this;
  }

  toOdata(): Object {
    const result = {
      ...this,
    };

    return result;
  }
}
