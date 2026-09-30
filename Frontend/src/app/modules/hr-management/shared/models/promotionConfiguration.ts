import { Deserializable } from "@app/shared/interfaces/deserializable";
import { promotionType } from "@app/modules/hr-management/shared/enums/promotionType";

export class PromotionConfiguration implements Deserializable {
  id?: number;
  custom_id?: string;
  is_active?: boolean = true;
  name?: string = "";
  scope_type: "department" | "employee" = "department";
  department_id?: number;
  employee_id?: number;
  months_of_service?: number;
  eligibility_date?: string;
  start_date?: string;
  end_date?: string;
  expiry_days?: number = 7;
  promotion_title?: string = "";
  promotion_type?: string = promotionType.REGULAR;
  note?: string = "";
  department?: any;
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
      department: undefined,
      employee: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
