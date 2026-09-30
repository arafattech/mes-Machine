import { Deserializable } from '@app/shared/interfaces/deserializable';

export interface ConfigChannelEntry {
  channel_id: number;
  machine_state_id: number | null;
}

export class MachineConfig implements Deserializable {
  id?: number;
  machine_id?: number = 0;
  machine_name: string = '';
  is_active: boolean = true;

  config_id?: number = 0;
  ip_plc: string = '';
  protocol: string = 'HTTP';
  type: string = 'Cast/cast_sig';
  read_from: string = 'API';

  shot_buffer?: number = 0;
  timeout_sec?: number = 0;
  server_call_sec?: number = 0;
  ideal_cycle_seconds?: number;

  auto_signal?: string = '';
  shot_signal?: string = '';
  inverse_auto: boolean = false;
  inverse_shot: boolean = false;
  auto_independent: boolean = false;

  live_status_api?: string = '';
  live_shot_api?: string = '';
  test_status_api?: string = '';
  test_shot_api?: string = '';

  active: boolean = false;
  scrap: boolean = false;
  robot_active: boolean = false;
  robot?: string = '';
  press_active: boolean = false;
  press?: string = '';
  handling_active: boolean = false;
  handling?: string = '';

  selection_type?: string = '';

  channels: ConfigChannelEntry[] = [];
  id_iot?: string = '';

  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.keys(input).forEach((key) => {
        const value = input[key];
        if (value !== undefined && value !== null) {
          (this as any)[key] = value;
        }
      });
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
