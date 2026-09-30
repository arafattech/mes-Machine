import { Deserializable } from '@app/shared/interfaces/deserializable';
export class EmployeeSection implements Deserializable {
  id?: number;
  name: string = '';
  is_active?: boolean = true;
  is_attendanceBonus?: boolean = false;
  is_overtimeBonus?: boolean = false;
  custom_id?: string;
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
