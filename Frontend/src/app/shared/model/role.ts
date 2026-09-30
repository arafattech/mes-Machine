import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Permission } from '@app/shared/model/permission';
export class Role implements Deserializable {
  id?: number;
  name: string = '';
  guard_name?: string = 'web';
  is_active?: boolean = true;
  syncPermissions?: Permission[];
  custom_id?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    if (input.syncPermissions) {
      this.syncPermissions = input.syncPermissions.map((item: any) =>
        new Permission().deserialize(item)
      );
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      syncPermissions: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
