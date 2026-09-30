import { Deserializable } from '@app/shared/interfaces/deserializable';

export class PurchaseQuote implements Deserializable {
  id?: number;
  custom_id?: string = '';
  purchase_requisition_id?: number | null = null;
  supplier_id?: number | null = null;
  quote_date?: string = '';
  valid_until?: string = '';
  status?: string = 'SUBMITTED';
  note?: string = '';
  items?: any[] = [];
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
      custom_id: this.custom_id,
      purchase_requisition_id: this.purchase_requisition_id,
      supplier_id: this.supplier_id,
      quote_date: this.quote_date,
      valid_until: this.valid_until,
      status: this.status,
      note: this.note,
      items: (this.items ?? []).map((item: any) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        delivery_date: item.delivery_date ?? null,
      })),
      created_at: undefined,
      updated_at: undefined,
      deleted_at: undefined,
    };
  }
}
