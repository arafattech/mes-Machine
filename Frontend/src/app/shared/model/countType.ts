import { Deserializable } from '@app/shared/interfaces/deserializable';

export class CountType implements Deserializable {
  id?: number;
  name: string = '';
  prefix: string = '';
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
