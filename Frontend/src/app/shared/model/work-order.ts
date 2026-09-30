import { Deserializable } from '@app/shared/interfaces/deserializable';

export type WorkOrderStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export class WorkOrder implements Deserializable {
  id?: number;
  custom_id?: string;
  is_active?: boolean = true;
  product_id: number | null = null;
  product_name?: string;
  machine_ids: number[] = [];
  machine_names: string[] = [];
  quantity: number | null = null;
  status: WorkOrderStatus = 'pending';
  scheduled_start?: string | null;
  actual_start?: string | null;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      this.product_name = input.product?.product_name ?? this.product_name;
      const machines = input.machines ?? [];
      this.machine_ids = machines.map((m: any) => m.id);
      this.machine_names = machines.map((m: any) => m.machine_name);
    }
    return this;
  }

  /** REST payload (not OData) — assigning multiple machines is a pivot sync, handled server-side. */
  toPayload(): Object {
    return {
      custom_id: this.custom_id,
      is_active: this.is_active,
      product_id: this.product_id,
      machine_ids: this.machine_ids,
      quantity: this.quantity,
      status: this.status,
      scheduled_start: this.scheduled_start,
      actual_start: this.actual_start,
    };
  }
}
