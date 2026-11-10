import { Deserializable } from '@app/shared/interfaces/deserializable';
import { factoryToday, formatFactoryDate, fromPickerDate } from '@shared/utilities/date-format';

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
  /** `DD/MM/YYYY` — `ui5-date-picker` value; converted at the API boundary. New orders default to today. */
  scheduled_start: string = formatFactoryDate(factoryToday());
  actual_start: string = '';
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      this.product_name = input.product?.product_name ?? this.product_name;
      // Existing orders always show their stored dates (even empty); only a new order keeps the defaults.
      if (input.id != null) {
        this.scheduled_start = formatFactoryDate(input.scheduled_start);
        this.actual_start = formatFactoryDate(input.actual_start);
      }
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
      scheduled_start: fromPickerDate(this.scheduled_start) || null,
      actual_start: fromPickerDate(this.actual_start) || null,
    };
  }
}
