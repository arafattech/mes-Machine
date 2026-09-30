import { Deserializable } from '@app/shared/interfaces/deserializable';

export class EmployeeSalary implements Deserializable {
  id?: number;
  title?: string = '';
  employee_id: number = 0;
  basic: number = 0;
  house_rent: number = 0;
  medical_allowance: number = 0;
  transport_allowance: number = 0;
  other_allowance: number = 0;
  total_salary: number = 0;
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
