import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Client } from '@app/shared/model/client';
import { Plant } from '@app/shared/model/plant';
import { ItemCategory } from '@app/shared/model/itemCategory';
import { ProductType } from '@app/shared/model/productType';
import { Supplier } from '@app/shared/model/supplier';
import { ItemSubCategory } from '@app/shared/model/itemSubCategory';
import { Variant } from '@app/shared/model/variant';

export class Product implements Deserializable {
  id?: number;
  item_code?: string = '';
  product_name: string = '';
  revision?: number;
  is_active?: boolean = true;
  is_variant?: boolean = false;
  is_parent?: boolean = true;
  has_variant?: boolean = false;
  is_sellable?: boolean = false;
  is_raw_cotton?: boolean = false;
  is_lot?: boolean = false;
  variant_id: number | null = null;
  item_category_id: number | null = null;
  variant_value: string = '';
  plants?: Plant[];
  part_number?: string = '';
  model_number?: string;
  rack_no: string = '';
  current_stock?: string;
  minimum_stock?: number = 0;
  currency?: string = 'BDT';
  unit_price?: string;
  price_in_bdt?: string;
  price_in_usd?: string;
  description?: string = '';
  uom_id?: string;
  clients?: Client[];
  suppliers?: Supplier[];
  productTypes?: ProductType[];
  itemCategories?: ItemCategory[];
  itemSubCategories?: ItemSubCategory[];
  variants?: Variant[];
  target_cycle_time?: float;
  custom_id?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }

    if (input.suppliers && input.suppliers.length > 0) {
      this.suppliers = input.suppliers.map((item: any) =>
        new Supplier().deserialize(item)
      );
    }

    if (input.plants && input.plants.length > 0) {
      this.plants = input.plants.map((item: any) =>
        new Plant().deserialize(item)
      );
    }
    if (input.clients && input.clients.length > 0) {
      this.clients = input.clients.map((item: any) =>
        new Client().deserialize(item)
      );
    }
    if (input.productTypes && input.productTypes.length > 0) {
      this.productTypes = input.productTypes.map((item: any) =>
        new ProductType().deserialize(item)
      );
    }
    if (input.itemCategories && input.itemCategories.length > 0) {
      this.itemCategories = input.itemCategories.map((item: any) =>
        new ItemCategory().deserialize(item)
      );
    }
    if (input.itemSubCategories && input.itemSubCategories.length > 0) {
      this.itemSubCategories = input.itemSubCategories.map((item: any) =>
        new ItemSubCategory().deserialize(item)
      );
    }
    if (!input.model_number) {
      this.model_number = '';
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      custom_id: undefined,
      plants: undefined,
      variants: undefined,
      clients: undefined,
      uom: undefined,
      productTypes: undefined,
      itemCategories: undefined,
      itemSubCategories: undefined,
      suppliers: undefined,
      created_at: undefined,
      updated_at: undefined,
      category: undefined,
      uom_id: this.uom_id ? Number(this.uom_id) : undefined,
    };
  }
}
