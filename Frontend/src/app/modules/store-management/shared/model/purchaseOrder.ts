import { Deserializable } from '@app/shared/interfaces/deserializable';
import { PurchaseOrderStatus } from '@store-module/shared/enum/purchase-order-status';

export class PurchaseOrder implements Deserializable {
  id?: number;
  mode?: 'POST' | 'PUT';
  custom_id?: string = '';
  spr_id?: number | null = null;
  supplier_id?: number | null = null;
  department_id?: number | null = null;
  po_date?: string = '';
  status?: PurchaseOrderStatus = PurchaseOrderStatus.PENDING;
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

  toOdata() {
    return {
      mode: this.mode,
      custom_id: this.custom_id,
      spr_id: this.spr_id,
      supplier_id: this.supplier_id,
      department_id: this.department_id,
      po_date: this.po_date,
      status: this.status,
      note: this.note,
      items: (this.items ?? []).map((item: any) => ({
        product_id: item.product_id,
        quantity: Number(item.quantity ?? 0),
        unit_price: Number(item.unit_price ?? 0),
        delivery_date: item.delivery_date ?? null,
      })),
    };
  }
}
