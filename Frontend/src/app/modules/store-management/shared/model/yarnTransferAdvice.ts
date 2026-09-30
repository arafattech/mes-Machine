import { Deserializable } from '@app/shared/interfaces/deserializable';

export type YarnAdviceStatusValue = 'draft' | 'hod_approved' | 'store_received' | 'gm_approved' | 'rejected' | 'cancelled';
export type YarnAdviceLineStatusValue = 'PENDING' | 'RECEIVED' | 'REJECTED';

export class YarnTransferAdviceLine implements Deserializable {
  id?: number;
  advice_id?: number;
  production_lot_count_id?: number;
  lot_no?: string | null;
  first_bag_serial?: number | null;
  last_bag_serial?: number | null;
  qty_out_cones?: number;
  gross_weight_kg_out?: number | null;
  net_weight_kg_out?: number | null;
  qty_in_cones?: number | null;
  net_weight_kg_in?: number | null;
  variance_cones?: number | null;
  status: YarnAdviceLineStatusValue = 'PENDING';
  received_at?: string | null;
  remark?: string | null;

  lotCustomId?: string;
  lotCountTypeName?: string;
  lotStatus?: string;
  lotVarianceCones?: number | null;

  /** UI-only receive-draft state — not persisted; read by YarnAdviceService.receiveLine(). */
  qtyInDraft: number | null = null;
  netWeightInDraft: number | null = null;
  remarkDraft = '';

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      // OData responses nest the relation as `productionLotCount` (Lodata reflects the
      // method name); plain REST responses (`response()->json($model)`) run it through
      // Eloquent's default `toArray()`, which snake_cases relation keys to
      // `production_lot_count` (and its own `countType` nested relation to `count_type`).
      // Both shapes have to be handled here since this deserializer runs on both.
      const lotCount = input.productionLotCount ?? input.production_lot_count;
      const lotCountType = lotCount?.countType ?? lotCount?.count_type;
      this.lotCustomId = lotCount?.custom_id ?? this.lotCustomId;
      this.lotCountTypeName = lotCountType?.name ?? this.lotCountTypeName;
      this.lotStatus = lotCount?.status ?? this.lotStatus;
      this.lotVarianceCones = lotCount?.variance_cones ?? this.lotVarianceCones;
    }
    return this;
  }
}

export class YarnTransferAdvice implements Deserializable {
  id?: number;
  custom_id?: string;
  from_hall_id: number | null = null;
  transfer_date: string | null = null;
  vehicle_no?: string | null;
  remarks?: string | null;
  status: YarnAdviceStatusValue = 'draft';
  rejected_reason?: string | null;
  hod_approved_at?: string | null;
  store_received_at?: string | null;
  gm_approved_at?: string | null;
  created_at?: string;

  fromHallName?: string;
  lines: YarnTransferAdviceLine[] = [];
  production_lot_count_ids: number[] = [];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      // See ProductionLot.deserialize — normalizes a possible full ISO timestamp down to
      // the plain `yyyy-MM-dd` the date-picker expects; a no-op on an already-plain date.
      if (this.transfer_date) this.transfer_date = String(this.transfer_date).slice(0, 10);
      this.fromHallName = input.fromHall?.name ?? this.fromHallName;
      this.lines = (input.lines ?? []).map((line: any) => new YarnTransferAdviceLine().deserialize(line));
    }
    return this;
  }

  /** REST payload (not OData) — matches YarnAdviceController::store/update validation. */
  toPayload(): Object {
    return {
      from_hall_id: this.from_hall_id,
      transfer_date: this.transfer_date,
      vehicle_no: this.vehicle_no || null,
      remarks: this.remarks || null,
      production_lot_count_ids: this.production_lot_count_ids,
    };
  }
}
