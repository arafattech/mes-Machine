import { Deserializable } from '@app/shared/interfaces/deserializable';

export class NoticeEmployee implements Deserializable {
  id?: number;
  is_acknowledged?: boolean = false;
  is_read?:boolean = false;
  published_at?: string;  
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
