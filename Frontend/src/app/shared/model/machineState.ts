import { Deserializable } from '@app/shared/interfaces/deserializable';

export class MachineState implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  name?:string = '';
  custom_id?: string;
  // Match the form's own visual defaults (first icon option, fallback swatch color) —
  // the icon <ui5-select> and color swatch show these before the user ever touches either
  // control, so a state saved without interacting with them must persist the same values.
  color?: string | null = 'rgb(0, 128, 0)';
  icon?: string | null = 'media-play';
  counts_as_productive?: boolean = false;
  priority?: number = 0;
  created_at?: string;
  updated_at?: string;
  is_default?: boolean;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
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
