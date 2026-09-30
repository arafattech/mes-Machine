import { Deserializable } from '@app/shared/interfaces/deserializable';
import { RequisitionUrgency, SprStatus } from '@store-module/shared/enum/spr-status';
export class PurchaseRequisition implements Deserializable {
  id?: number;
  custom_id?: string;
  requested_by?: number;
  department_id?: number;
  description?: string = '';
  rejected_reason?: string = '';
  request_date?: string = '';
  required_by?: string = '';
  urgency?: RequisitionUrgency;
  status?: SprStatus;
  approved_by?: number;
  approved_at?: string;
  final_approved_by?: number;
  final_approved_at?: string;
  is_acknowledge_required?: boolean = false;
  is_acknowledged?: boolean = false;
  is_imported?: boolean = false;
  feedback?: string = '';
  estimated_cost?: number;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;


  deserialize(input: any): this {
  if (input) {
      Object.assign(this, input);
    }
    return this;
  }

  toOdata(): object {
    return {
        ...this,
      created_at: undefined,
      updated_at: undefined,
      deleted_at: undefined,
    };
  }
}
