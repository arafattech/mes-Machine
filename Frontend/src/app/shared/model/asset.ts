import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Employee } from '@shared/model/employee';
import { EmployeeHasAsset } from '@app/modules/hr-management/shared/models/employeeHasAsset';

export class Asset implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  name?: string = '';
  custom_id?: string;
  employees: Employee[] = [];
  created_at?: string;
  updated_at?: string;
  employeeHasAssets?: EmployeeHasAsset[] = [];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    if (input.employees && Array.isArray(input.employees)) {
      this.employees = input.employees.map((emp: any) =>
        new Employee().deserialize(emp)
      );
    }
    if (input.employeeHasAssets && Array.isArray(input.employeeHasAssets)) {
      this.employeeHasAssets = input.employeeHasAssets.map((assign: any) =>
        new EmployeeHasAsset().deserialize(assign)
      );
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      employeeHasAssets: undefined,
      employees: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
