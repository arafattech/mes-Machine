import { Deserializable } from '@app/shared/interfaces/deserializable';
import { MachineGroup } from '@app/shared/model/machineGroup';
import { MachineState } from '@app/shared/model/machineState';
import { Hall } from '@app/shared/model/hall';
import { MachineWastageType } from '@app/shared/model/machineWastageType';
export class Machine implements Deserializable {
  id?: number;
  machine_name: string = '';
  is_active?: boolean = true;
  has_temperature?: boolean = false;
  has_rpm?: boolean = false;
  has_config?: boolean = false;
  has_wastage?: boolean = false;
  oee?: number;
  custom_id?: string;
  machinegroups?: MachineGroup[];
  states?: MachineState[];
  machinehalls?: Hall[];
  machinewastagetypes?: MachineWastageType[];
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
      machinegroups: undefined,
      machinehalls: undefined,
      states: undefined,
      machinewastagetypes: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
