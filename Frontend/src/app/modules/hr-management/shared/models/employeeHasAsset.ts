import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Employee } from '@shared/model/employee';
import { Asset } from '@shared/model/asset';

export class EmployeeHasAsset implements Deserializable {
  id?: number;
  employee_id?: number;
  asset_id?: number;
  issued_date?: string = '';
  return_date?: string = '';
  remarks?: string = '';
  note?: string = '';
  is_active?: boolean = true;
  custom_id: string = '';
  created_at?: string;
  updated_at?: string;

  employees?: Employee;
  assets?: Asset;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      this.issued_date = input.issued_date || '';
      this.return_date = input.return_date || '';
    }

    if (input.employee) {
      this.employees = new Employee().deserialize(input.employee);
    }

    if (input.assets) {
      this.assets = new Asset().deserialize(input.assets);
    }

    return this;
  }

  toOdata(): Object {
    const result = {
      ...this,
      employee: undefined,
      employees: undefined,
      assets: undefined,
      asset: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
    if (!this.issued_date) {
      delete result.issued_date;
    }
    if (!this.return_date) {
      delete result.return_date;
    }
    return result;
  }
}
