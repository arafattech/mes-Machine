import { Deserializable } from '@app/shared/interfaces/deserializable';

export class TaxRule implements Deserializable {
  id?: number;
  name: string = '';
  employee_id?: number | null = null;
  salary_from?: number | null = null;
  salary_to?: number | null = null;
  is_percentage: boolean = true;
  tax_rate?: number | null = null;
  fixed_amount?: number | null = null;
  effective_from: string = '';
  effective_to?: string | null = null;
  is_active: boolean = true;
  created_at?: string;
  updated_at?: string;

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
      created_at: undefined,
      updated_at: undefined,
    };

    return result;
  }
}
