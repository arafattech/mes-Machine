import { Deserializable } from '@app/shared/interfaces/deserializable';

export class HolidayType implements Deserializable {
  id?: number;
  name: string = '';
  color: string = '';
  is_active: boolean = true;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    return this;
  }

  toOdata(): Object {
    const result = {
      ...this,
      created_at: undefined,
      updated_at: undefined,
    };

    return result;
  }
}
