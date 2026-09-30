import { Deserializable } from '@app/shared/interfaces/deserializable';
import { SaleOrderItem } from './sales-order-items';
import { SalesStatus } from '../enums/sales-status';

export class SalesOrder implements Deserializable {
  id?: number;
  client_id?: number;
  order_no?: string = '';
  custom_id: string = '';
  order_date?: string;
  expected_delivery_date?: string;
  status?: string = '';
  subtotal?: number = 0;
  paid_amount?: number = 0;
  due_amount?: number = 0;
  grand_total?:number =0;
  vat?: number =0;
  discount?:number =0;
  discount_type?:string ='';
  discount_amount?:number =0;
  discount_option?:string ='';
  note?: string = '';
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;

  items?: SaleOrderItem[] = [];

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);

      if (input.items && Array.isArray(input.items)) {
        this.items = input.items.map((i: any) =>
          new SaleOrderItem().deserialize(i)
        );
      }
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      created_at: undefined,
      updated_at: undefined,
      deleted_at: undefined,
      items: this.items?.map((item) => item.toOdata()),
    };
  }

  /**
   * Calculate due amount dynamically
   */
  calculateDue(): number {
    return (this.subtotal || 0) - (this.paid_amount || 0);
  }
}
