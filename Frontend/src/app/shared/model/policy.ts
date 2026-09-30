import { Deserializable } from '@app/shared/interfaces/deserializable';
import { User } from '@shared/model/user';

export class Policy implements Deserializable {
  id?: number;
  title: string = '';
  description?: string;
  terms?: string;
  condition?: string;
  assigned_by?: number;
  assigned_to?: number;
  is_active?: boolean = true;
  custom_id?: string;
  created_at?: string;
  updated_at?: string;
  assignedBy?: User;
  user?: User;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }

    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      assigned_by: JSON.parse(localStorage.getItem('userInfo') || '{}').id,
      assignedBy: undefined,
      user: undefined,
      User: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
