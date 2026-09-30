import { Deserializable } from '@app/shared/interfaces/deserializable';

export class LoginActivity implements Deserializable {
  id?: number;
  table_name?: string;
  table_id?: number;
  user_name?: string;
  ip_address?: string;
  login_time?: string;
  logout_time?: string;
  login_date?: string;
  login_response?: string;
  logout_response?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    return this;
  }
}
