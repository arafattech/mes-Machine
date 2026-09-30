import { Deserializable } from '@app/shared/interfaces/deserializable';

export class StorageLocation implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  custom_id?: string;
  name: string = '';
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
