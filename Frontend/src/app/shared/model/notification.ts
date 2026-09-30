import { Deserializable } from '@app/shared/interfaces/deserializable';
import { User } from '@app/shared/model/user';

export class AppNotification implements Deserializable {
  id?: number;
  recipient_id?: number;
  sender_id?: number;
  model_type?: string;
  model_id?: number;
  model_custom_id?: string;
  action_type: string = '';
  title: string = '';
  message: string = '';
  is_read: boolean = false;
  read_at?: string;
  sender?: User;
  deleted_at?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      if (input.sender) {
        this.sender = new User().deserialize(input.sender);
      }
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
