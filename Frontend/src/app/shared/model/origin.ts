import { Deserializable } from '@app/shared/interfaces/deserializable';

export class Origin implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  custom_id?: string;
  name?: string = '';
  remarks?: string = '';
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    Object.assign(this, input);
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      custom_id: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
