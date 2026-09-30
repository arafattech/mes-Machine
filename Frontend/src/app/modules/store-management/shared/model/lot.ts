import { Deserializable } from '@app/shared/interfaces/deserializable';

export class Lot implements Deserializable {
  id?: number;
  lot_number = '';
  product_id?: number | null = null;
  mrr_item_id?: number | null = null;
  bale_quantity?: number | null = 0;
  gross_weight_kg?: number | null = null;
  tare_weight_kg?: number | null = null;
  net_weight_kg?: number | null = null;
  moisture_pct?: number | null = null;
  received_date?: string | null = null;
  status?: string = 'IN_STOCK';
  remarks?: string | null = null;

  product?: { id?: number; product_name?: string; item_code?: string };
  materialReceiptItem?: { id?: number; material_receipt_id?: number };

  deserialize(input: Partial<Lot>): this {
    if (input) {
      Object.assign(this, input);
    }
    return this;
  }
}
