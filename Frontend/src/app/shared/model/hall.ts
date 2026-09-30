import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Plant } from '@app/shared/model/plant';

export class Hall implements Deserializable {
  id?: number;
  name: string = '';
  is_active?: boolean = true;
  plants?: Plant[];
  custom_id?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }

    if (input.plants && input.plants.length > 0) {
      this.plants = input.plants.map((item: any) =>
        new Plant().deserialize(item)
      );
    }

    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      plants: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
