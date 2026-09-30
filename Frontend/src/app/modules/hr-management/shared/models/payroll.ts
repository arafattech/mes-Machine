import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Employee } from '@shared/model/employee';
import moment from 'moment';

export class Payroll implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  employee_id?: number;
  employee?: Employee;
  month?: number | boolean;
  year?: number;
  basic_salary?: number;
  allowances?: number;
  overtime?: number;
  overtime_bonus?: number;
  bonuses?: number;
  side_bill?: number;
  gross_salary?: number;
  tax?: number;
  social_security?: number;
  loans?: number;
  penalties?: number;
  other_deductions?: number;
  total_deductions?: number;
  net_salary?: number;
  currency?: string = 'BDT';
  status?: string = 'pending';
  processed_at?: string;
  paid_at?: string | null;
  payment_method?: string | null;
  transaction_ref?: string | null;
  hr_notes?: string | null;
  created_at?: string;
  updated_at?: string;
  total_attendance?: number;
  total_nightshift?: number;
  nightshift_bonus?: number;
  attendance_bonus?: number;
  ramadan_bonus?: number;
  holiday_bonus?: number;
  total_holidays?: number;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }

    return this;
  }

  toOdata(): Object {
    const result = {
      ...this,
      employee: undefined,
    };

    return result;
  }
}
