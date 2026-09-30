import { Deserializable } from '@app/shared/interfaces/deserializable';

export class BonusConfig implements Deserializable {
  id?: number;
  name: string = '';
  calculation_type?: string = '';
  applicable_to?: string = '';
  amount?: number;
  bonus_type_id?: number | null = null;
  group_id?: number | null = null;
  department_id? : number | null = null;
  employee_id? : number | null = null;
  is_active?: boolean = true;
  custom_id?: string;
  department?: any;
  group?: any;
  employee?: any;
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
      calculation_type: undefined,
      department: undefined,
      group: undefined,
      employee: undefined,
      bonusType: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
