import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Role } from '@app/shared/model/role';
export class User implements Deserializable {
  id?: number;
  name: string = '';
  email?: string = '';
  phone?: string = '';
  password?: string = '';
  is_active?: boolean = true;
  roles?: Role[];
  role_id?: number;
  custom_id?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  media?: any[] = [];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      this.email = input.email ?? '';
    }
    if (input.roles) {
      this.roles = input.roles.map((item: any) => new Role().deserialize(item));
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      roles: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
