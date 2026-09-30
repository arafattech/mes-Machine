import { Deserializable } from '@app/shared/interfaces/deserializable';

export class Variant implements Deserializable {
  id?: number;
  name: string = '';
  is_active?: boolean = true;
  custom_id?: string;
  variant_id?: string;
  variant_name?: string;
  variant_unit_price?: string;
  variant_currency?: string;
  variant_price_in_bdt?: string;
  variant_price_in_usd?: string;
  variant_unit_price_in_usd?: string;
  variant_value?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      this.variant_id = input.variant_id?.toString() || undefined;
      this.id = input.id ? Number(input.id) : undefined;
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
