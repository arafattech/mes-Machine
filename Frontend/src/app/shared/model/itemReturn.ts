import { Deserializable } from '@app/shared/interfaces/deserializable';

export class ItemReturn implements Deserializable {
  id?: number;
  custom_id?: string = '';
  purchase_requisition_id?: number | null = null;
  department_id?: number | null = null;
  requested_by?: number | null = null;
  reason?: string | null = '';
  return_date?: string | null = null;
  status?: string = 'PENDING';
  is_received?: boolean = false;
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
      purchaseRequisition: undefined,
      department: undefined,
      requestBy: undefined,
      returnItems: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
