import { Deserializable } from '@app/shared/interfaces/deserializable';

export class EmployeeHolidaySwap implements Deserializable {
  id?: number;
  employee_id?: number;
  weekend_id?: number | null;
  original_holiday_date: string = '';
  swapped_holiday_date: string = '';
  type: string = 'HOLIDAY';
  status: string = 'APPROVED';
  reason: string = '';
  created_at?: string;
  updated_at?: string;
  employee_name: string = '';

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    if (input.employee) {
      this.employee_name =
        `${input.employee.first_name || ''} ${input.employee.last_name || ''}`.trim() ||
        'No Employee';
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
