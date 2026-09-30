import { Deserializable } from '@app/shared/interfaces/deserializable';
import { User } from '@app/shared/model/user';

export class ActivityLog implements Deserializable {
  id?: number;
  action_type: string = '';
  custom_id?: string;
  ip_address?: string;
  is_active?: boolean = true;
  is_read?: boolean;
  model_custom_id?: string;
  model_id?: number;
  model_type?: string;
  new_value?: string = '';
  old_value?: string = '';
  session_id?: string;
  user_id?: number;
  user_name?: string;
  user_email?: string;
  user?: User;
  deleted_at?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);

      if (input.user) {
        this.user = new User().deserialize(input.user);
      }
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
