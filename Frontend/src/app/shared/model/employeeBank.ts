import { Deserializable } from "@app/shared/interfaces/deserializable";

export class EmployeeBank implements Deserializable {
  id?: number;
  employee_id?: number;
  is_active?: boolean = true;
  bank_name?: string = "";
  branch_name?: string = "";
  account_number?: string = "";
  account_holder_name?: string = "";
  swift_code?: string = "";
  created_at?: string;
  is_primary?: boolean = false;
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
      isSelected: undefined,
    };
  }
}
