import { Deserializable } from '@app/shared/interfaces/deserializable';

export class ApprovalType implements Deserializable {
  id?: number;
  code: string = '';
  name: string = '';
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
    return {
      ...this,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
