import { calculateTotalHours, formatTime, calculateHoursFromMinutes } from '@app/modules/hr-management/shared/utilities/dateTime-format';
import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Employee } from '@shared/model/employee';
import moment from 'moment';

export class Attendance implements Deserializable {
  id?: number;
  employee_id?: number;
  employee_no?: number;
  attendance_date: string = '';
  is_active?: boolean = true;
  custom_id?: string;
  employee?: Employee;
  check_in_time?: string = '';
  check_out_time?: string = '';
  totalWorkingHour?: string = '0h';
  totalHours?: string = '0h';
  in_time?: string;
  out_time?: string;
  shift_id?: number;
  shift?: any;
  status?: string;
  attendance_status?: string = '';
  created_at?: string;
  updated_at?: string;
  momentStart?: moment.Moment;
  has_overtime?: boolean = false;
  overtime_minutes?: number;
  overtime_hours?: string;
  overtime_status?: string;
  over_time?: string;
  is_ramadan_duty?: boolean = false;
  is_holiday_bonus_duty?: boolean = false;
  ramadan_status?: string;
  holiday_bonus_status?: string;
  is_ot?: boolean = false;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);

      this.in_time = input.check_in_time;
      this.out_time = input.check_out_time;

      this.check_in_time = input.check_in_time ? formatTime(input.check_in_time) || '' : '';
      this.check_out_time = input.check_out_time ? formatTime(input.check_out_time) || '' : '';

      if (input.check_in_time && input.check_out_time) {
        this.totalWorkingHour = calculateTotalHours(
          input.check_in_time,
          input.check_out_time,
        );
      } else {
        this.totalWorkingHour = '0h';
      }

      this.overtime_hours = calculateHoursFromMinutes(
        input.overtime_minutes,
        input.over_time || '0h 0m'
      );

      this.totalHours = calculateTotalHours(
        input.check_in_time,
        input.check_out_time,
      );

      this.attendance_status =
        input.check_in_time || input.check_out_time ? 'present' : 'absent';
    }

    return this;
  }

  toOdata(): Object {
    const result = {
      ...this,
      totalHours: undefined,
      totalWorkingHour: undefined,
      employee_no: undefined,
      custom_id: undefined,
      employee: undefined,
      Employee: undefined,
      created_at: undefined,
      attendance_status: undefined,
      updated_at: undefined,
      in_time: undefined,
      out_time: undefined,
      overtime_hours: undefined,
      over_time: undefined,
      shift: undefined,
      momentStart: undefined,
    };
    if (!this.check_in_time) {
      delete result.check_in_time;
    }
    if (!this.check_out_time) {
      delete result.check_out_time;
    }
    return result;
  }
}
