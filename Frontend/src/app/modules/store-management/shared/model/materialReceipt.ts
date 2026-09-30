import { Deserializable } from '@app/shared/interfaces/deserializable';


export class MaterialReceipt implements Deserializable {
  id?: number;
  custom_id?: string = '';
  purchase_order_id?: number | null = null;
  purchase_requisition_id?: number | null = null;
  supplier_id?: number | null = null;
  department_id?: number | null = null;
  requested_by?: number | null = null;
  receipt_date?: string = '';
  remarks?: string = '';
  source?: string = 'LOCAL';
  invoice_no?: string = '';
  lc_no?: string = '';
  vehicle_no?: string = '';
  status?: string = 'PARTIAL';
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  items?: any[] = [];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }

    return this;
  }

  toOdata() {
    return {
      custom_id: this.custom_id,
      purchase_order_id: this.purchase_order_id,
      purchase_requisition_id: this.purchase_requisition_id,
      supplier_id: this.supplier_id,
      department_id: this.department_id,
      requested_by: this.requested_by,
      receipt_date: this.receipt_date,
      remarks: this.remarks,
      source: this.source,
      invoice_no: this.invoice_no,
      lc_no: this.lc_no,
      vehicle_no: this.vehicle_no,
      status: this.status,
      items: (this.items ?? []).map((item: any) => ({
        product_id: item.product_id,
        po_item_id: item.po_item_id ?? null,
        required_quantity: Number(item.required_quantity ?? 0),
        received_quantity: Number(item.received_quantity ?? 0),
        receiving_quantity: Number(item.receiving_quantity ?? 0),
        remark: item.remark ?? '',
      })),
      created_at: undefined,
      updated_at: undefined,
      deleted_at: undefined,
    };
  }
}
