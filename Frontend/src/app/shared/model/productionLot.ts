import { Deserializable } from '@app/shared/interfaces/deserializable';

export type LotStatusValue =
  | 'DOFFED'
  | 'QC_FAILED'
  | 'PACKED'
  | 'PENDING_TRANSFER'
  | 'REJECTED'
  | 'RECEIVED'
  | 'RECONCILED'
  | 'CANCELLED';

export class ProductionLotItem implements Deserializable {
  id?: number;
  production_lot_count_id?: number;
  bag_no: number | null = null;
  cone_count: number | null = null;
  gross_weight_kg: number | null = null;
  net_weight_kg: number | null = null;
  remark?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    return this;
  }
}

export class ProductionLotCount implements Deserializable {
  id?: number;
  custom_id?: string;
  production_lot_id?: number;
  count_type_id: number | null = null;
  product_id: number | null = null;
  total_cones?: number;
  total_bags?: number;
  gross_weight_kg?: number | null;
  net_weight_kg?: number | null;
  qc_status?: 'PASSED' | 'FAILED' | null;
  qc_remark?: string | null;
  variance_cones?: number | null;
  status: LotStatusValue = 'DOFFED';
  rejected_reason?: string | null;

  items: ProductionLotItem[] = [];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      this.items = (input.items ?? []).map((item: any) => new ProductionLotItem().deserialize(item));
    }
    return this;
  }
}

export class ProductionLot implements Deserializable {
  id?: number;
  custom_id?: string;
  lot_no: string | null = null;
  work_order_id: number | null = null;
  machine_id: number | null = null;
  hall_id: number | null = null;
  shift_id: number | null = null;
  operator_id: number | null = null;
  lot_date: string | null = null;
  doffed_at?: string | null;
  created_at?: string;

  counts: ProductionLotCount[] = [];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      // Backend may return a full ISO timestamp (e.g. from a `date`-cast column) — the
      // date-picker only ever wants the `yyyy-MM-dd` portion, and slicing a plain date
      // string is a no-op, so this is safe regardless of which shape the API returned.
      if (this.lot_date) this.lot_date = String(this.lot_date).slice(0, 10);
      this.counts = (input.counts ?? []).map((count: any) => new ProductionLotCount().deserialize(count));
    }
    return this;
  }

  /** REST payload for updating the shared batch header. */
  toPayload(): Object {
    return {
      lot_no: this.lot_no || null,
      work_order_id: this.work_order_id,
      machine_id: this.machine_id,
      hall_id: this.hall_id,
      shift_id: this.shift_id,
      operator_id: this.operator_id,
      lot_date: this.lot_date,
      doffed_at: this.doffed_at,
    };
  }

  /** REST payload for creating the batch + its initial count-lines in one call. */
  toCreatePayload(draftCounts: { count_type_id: number | null; product_id: number | null }[]): Object {
    return {
      ...this.toPayload(),
      counts: draftCounts,
    };
  }
}
