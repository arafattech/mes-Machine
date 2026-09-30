import { Deserializable } from '@app/shared/interfaces/deserializable';

export class BiometricConfigurations implements Deserializable {
  id?: number;
  is_active: boolean = true;
  name: string = '';
  ip: string = '';
  port: number = 4370;
  timeout: number = 10000;
  inport: number = 4000;
  created_at?: string;
  updated_at?: string;

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
