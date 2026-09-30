import { Deserializable } from '@app/shared/interfaces/deserializable';

export class MachineProductionTarget implements Deserializable {
  id?: number;
  machine_id?: number;
  work_order_id?: number;
  shift_id?: number;
  target_qty: number = 0;
  effective_from: string = '';
  effective_to?: string;
  is_active?: boolean = true;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      // `effective_from`/`effective_to` come back from OData as full ISO datetimes
      // (the column is a `datetime`, not a `date`) — truncate to `yyyy-MM-dd` so
      // `ui5-date-picker`'s `format-pattern="yyyy-MM-dd"` binding shows a real date
      // instead of the raw ISO string.
      this.effective_from = this.toDateOnly(input.effective_from) ?? this.effective_from;
      this.effective_to = this.toDateOnly(input.effective_to);
    }
    return this;
  }

  private toDateOnly(value: string | null | undefined): string | undefined {
    return value ? value.slice(0, 10) : undefined;
  }

  toOdata(): Object {
    return {
      ...this,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
