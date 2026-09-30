import { Deserializable } from '@app/shared/interfaces/deserializable';

export class LeaveType implements Deserializable {
  id?: number;
  name: string = '';
  max_days: number = 0;
  is_active: boolean = true;
  is_paid: boolean = false;
  document_required: boolean = false;
  approval_type_id?: number | null = null;
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
      approvalType: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
