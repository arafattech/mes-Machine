import { Deserializable } from '@app/shared/interfaces/deserializable';
import { ItemSubCategory } from '@app/shared/model/itemSubCategory';
export class ItemCategory implements Deserializable {
  id?: number;
  is_active: boolean = true;
  name: string = '';
  prefix: string = '';
  subcategories?: ItemSubCategory[];
  custom_id?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    if(input.subcategories) {
        this.subcategories = input.subcategories.map((item: any) => new ItemSubCategory().deserialize(item));
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
