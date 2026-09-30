import { Deserializable } from '@app/shared/interfaces/deserializable';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import { EmployeeGroup } from '@app/modules/hr-management/shared/models/employeeGroup';

export class Roster implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  custom_id?: string;
  name?: string = '';
  group_id?: number;
  group?: EmployeeGroup[] = [];
  shift_id?: number;
  shift?: EmployeeShift[] = [];
  start_date?: string = '';
  end_date?: string = '';
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    return this;
  }

  toOdata(): Object {
    const result = {
      ...this,
      custom_id: undefined,
      group: undefined,
      shift: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
    if (!this.start_date) {
      delete result.start_date;
    }
    if (!this.end_date) {
      delete result.end_date;
    }
    return result;
  }
}
