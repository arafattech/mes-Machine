import { Deserializable } from '@app/shared/interfaces/deserializable';
import { formatTime } from '@app/modules/hr-management/shared/utilities/dateTime-format';
import { Employee } from '@app/shared/model/employee';

export class EmployeeShift implements Deserializable {
  id?: number;
  custom_id: string = '';
  name: string = '';
  start_time?: string = '';
  late_start_time?: string = '';
  early_start_time?: string = '';
  end_time?: string = '';
  overtime?: string = '';
  is_night: boolean = false;
  night_shift_bonus_amount?: number = 0;
  is_ramadan_bonus: boolean = false;
  ramadan_bonus_amount?: number = 0;
  is_active?: boolean = true;
  total_working_hours?: string = '';
  color: string = '';
  replacementEmployee: Employee[] = [];
  absentEmployee: Employee[] = [];
  group_id?: number;
  group_ids?: number[];
  created_at?: string;
  updated_at?: string;
  employees?: Employee[];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      this.start_time = formatTime(input.start_time) ?? '';
      this.late_start_time = formatTime(input.late_start_time) ?? '';
      this.early_start_time = formatTime(input.early_start_time) ?? '';
      this.end_time = formatTime(input.end_time) ?? '';
    }
    return this;
  }

  toOdata(): Object {
    const result = {
      ...this,

      group_id: undefined,
      group_ids: undefined,
      replacementEmployee: undefined,
      absentEmployee: undefined,
      overtime: undefined,
      employees: undefined,
      created_at: undefined,
      updated_at: undefined,
    };

    return result;
  }
}
