import { Deserializable } from '@app/shared/interfaces/deserializable';

export class EmployeeBonus implements Deserializable {
  id?: number;
  bonus_type?: string;
  amount?: number | string;
  description?: string = '';
  group_id?: number | null;
  emp_id?: number | null;
  config_id?: number | null;
  department_id?: number | null;
  attendance_log_id?: number | null;
  shift_id?: number | null;
  attendance_date?: string = '';
  overtime_minutes?: number | null;
  calculation_type?: string = '';
  bonus_config_amount?: number | string = '';
  bonus_type_id?: number | null;
  source_type?: string = '';
  remarks?: string = '';
  created_at?: string;
  updated_at?: string;
  employee?: any;
  shift?: any;
  bonusType?: any;
  bonusConfig?: any;
  attendanceLog?: any;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }

    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      employee: undefined,
      shift: undefined,
      bonusType: undefined,
      bonusConfig: undefined,
      attendanceLog: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
