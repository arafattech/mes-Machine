import { Deserializable } from '@app/shared/interfaces/deserializable';

export class Promotion implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  custom_id?: string;
  employee_id?: number;
  promotion_configuration_id?: number;
  promotion_title: string = '';
  promotion_type: string = '';
  old_designation: string = '';
  new_designation: string = '';
  old_department_id?: number;
  new_department_id?: number;
  old_salary?: number;
  new_salary?: number;
  salary_increment?: number;
  increment_type?: string;
  inc_value?: number;
  promotion_date: string = '';
  effective_date: string = '';
  status: string = 'pending';
  cycle_base_date?: string;
  eligibility_date?: string;
  expires_at?: string;
  approved_by?: number;
  approved_at?: string;
  employee?: any;
  oldDepartment?: any;
  newDepartment?: any;
  approvedBy?: any;
  configuration?: any;
  note?: string = '';
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
      employee: undefined,
      employees: undefined,
      oldDepartment: undefined,
      old_department: undefined,
      old_departments: undefined,
      newDepartment: undefined,
      new_department: undefined,
      new_departments: undefined,
      approvedBy: undefined,
      approved_by: undefined,
      configuration: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
