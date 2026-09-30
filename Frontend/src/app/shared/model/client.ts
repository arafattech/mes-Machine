import { Deserializable } from '@app/shared/interfaces/deserializable';
import { ClientArea } from '@app/shared/model/clientArea';
import { ClientNote } from '@app/shared/model/clientNote';

export class Client implements Deserializable {
  id?: number;
  name: string = '';
  address?: string = '';
  first_contact_person_name?: string = '';
  first_contact_person_phone?: string = '';
  second_contact_person_name?: string = '';
  second_contact_person_phone?: string = '';
  tin?: string = '';
  bin?: string = '';
  email?: string = '';
  is_active?: boolean = true;
  custom_id?: string;
  areas?: ClientArea[];
  notes?: ClientNote[];
  bill_to ?: string = '';
  ship_to ?: string = '';
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
      notes: undefined,
      areas: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
