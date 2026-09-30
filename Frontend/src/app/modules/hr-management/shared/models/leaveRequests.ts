import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Employee } from '@shared/model/employee';

export class LeaveRequests implements Deserializable {
  id?: number;
  leave_type_id?: number;
  employee_id?: number;
  supervisor_id?: number;
  hr_id?: number;
  created_by?: number;
  start_date?: string = '';
  end_date?: string = '';
  reason?: string;
  supervisor_status?: string;
  hr_status?: string;
  designation?: string;
  final_status?: string;
  applied_on?: string;
  is_active?: boolean = true;
  custom_id: string = '';
  created_at?: string;
  updated_at?: string;
  supervisor?: Employee[] = [];
  employee?: Employee;
  leavetype?: { id: number; name: string; approval_type_id?: number | null };
  supervisor_name_format: any = '';

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
    }
    if (input.supervisor) {
      this.supervisor_name_format =
        `${input.supervisor.first_name || ''} ${
          input.supervisor.last_name || ''
        }`.trim() || 'No Supervisor';
    }

    return this;
  }

  toOdata(): Object {
    return {
      ...this,
      supervisor_name_format: undefined,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
