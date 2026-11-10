import { Deserializable } from '@app/shared/interfaces/deserializable';
import { formatFactoryDate, fromPickerDate } from '@shared/utilities/date-format';

export class MachineProductionTarget implements Deserializable {
  id?: number;
  machine_id?: number;
  work_order_id?: number;
  shift_id?: number;
  target_qty: number = 0;
  /** `DD/MM/YYYY` — `ui5-date-picker` value; converted at the API boundary. */
  effective_from: string = '';
  effective_to?: string;
  is_active?: boolean = true;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      this.effective_from = formatFactoryDate(input.effective_from);
      this.effective_to = formatFactoryDate(input.effective_to);
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      effective_from: fromPickerDate(this.effective_from),
      effective_to: fromPickerDate(this.effective_to) || null,
      // Expanded navigation objects from the list row; lodata would treat them as nested writes.
      machine: undefined,
      workOrder: undefined,
      shift: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
