import { Deserializable } from '@app/shared/interfaces/deserializable';

export class Notice implements Deserializable {
  id?: number;
  is_active: boolean = true;
  custom_id?: string = '';
  title: string = '';
  content: string = '';
  departments?: any[];
  employees?: any[]; 
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
      employees: undefined,
      departments: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
