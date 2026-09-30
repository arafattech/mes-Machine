import { Deserializable } from '@app/shared/interfaces/deserializable';

export class SalaryType implements Deserializable {
  id?: number;
  name: string = '';
  type: string = 'earning';
  is_active?: boolean = true;
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
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
