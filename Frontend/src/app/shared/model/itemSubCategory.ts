import { Deserializable } from '@app/shared/interfaces/deserializable';
import { ItemCategory } from '@app/shared/model/itemCategory';

export class ItemSubCategory implements Deserializable {
  id?: number;
  category_id?: number;
  is_active: boolean = true;
  name: string = '';
  custom_id?: string;
  category?: ItemCategory;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
       Object.assign(this, input);
    }
    if (input.category) {
      this.category = new ItemCategory().deserialize(input.category);
    }
    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      custom_id: undefined,
      category: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}