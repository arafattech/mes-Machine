import { Deserializable } from '@app/shared/interfaces/deserializable';

export class Holiday implements Deserializable {
  id?: number;
  start_date?: string = '';
  end_date?: string = '';
  type_id?: number;
  title?: string;
  is_recurring?: boolean = false;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    return this;
  }

  toOdata(): object {
    return {
        ...this,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
