import { Deserializable } from '@app/shared/interfaces/deserializable';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import { Attendance } from '@app/modules/hr-management/shared/models/attendance';
import { EmployeeSalary } from '../../modules/hr-management/shared/models/EmployeeSalary';
import { Asset } from '@shared/model/asset';
import { EmployeeHasAsset } from '@app/modules/hr-management/shared/models/employeeHasAsset';
import { s } from '@fullcalendar/core/internal-common';

export class Employee implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  custom_id?: string = '';
  shift_id?: number;
  group_id?: number | null;
  employeeShifts?: EmployeeShift;
  first_name?: string = '';
  last_name?: string = '';
  name?: string = '';
  emgerency_contact_person_name?: string = "";
  emgerency_contact_number?: string = '';
  emgerency_contact_relation?: string = '';
  gender?: string = '';
  nid?: string = '';
  religion?: string = '';
  present_address?: string = '';
  permanent_address?: string = '';
  email?: string = '';
  address?: string = '';
  contact_number?: string = '';
  is_supervisor?: boolean = false;
  employee_no?: string = '';
  employee_type?: string = '';
  employee_shift?: string = '';
  designation?: string = '';
  joining_date?: string = '';
  blood_group?: string = '';
  date_of_birth?: string = '';
  supervisor_name?: string = '';
  refered_by?: string = '';
  department?: string = '';
  section?: string = '';
  role?: string = '';
  media?: any[] = [];
  created_at?: string;
  updated_at?: string;
  supervisor_id?: number;
  attendance?: Attendance;
  attendancelogs?: Attendance[] = [];
  salary?: EmployeeSalary[] = [];
  assets?: Asset;
  department_id?: number;
  employee_type_id?: number;
  designation_id?: number;
  employee_section_id?: number;
  shift?: EmployeeShift;
  employeeHasAssets?: EmployeeHasAsset[] = [];
  supervisor?: Employee[] = [];
  supervisor_name_format: any = '';
  is_shift_fixed?: boolean = false;
  group?: any;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);
      this.name = `${input.first_name || ''} ${input.last_name || ''}`.trim();
      this.date_of_birth = input.date_of_birth || '';
      this.joining_date = input.joining_date || '';
    }
    if (!input.email) {
      this.email = '';
    }
    if (input.employeeShifts) {
      this.employeeShifts = new EmployeeShift().deserialize(
        input.employeeShifts
      );
    }

    if (input.attendance) {
      this.attendance = new Attendance().deserialize(input.attendance);
    }
    if (input.attendancelogs) {
      this.attendancelogs = input.attendancelogs.map((item: any) =>
        new Attendance().deserialize(item)
      );
    }

    if (input.assets && input.assets.length > 0) {
      this.assets = input.assets.map((item: any) =>
        new Asset().deserialize(item)
      );
    }

    if (input.employeeHasAssets && Array.isArray(input.employeeHasAssets)) {
      this.employeeHasAssets = input.employeeHasAssets.map((assign: any) =>
        new EmployeeHasAsset().deserialize(assign)
      );
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
    const result = {
      ...this,
      name: undefined,
      assets: undefined,
      supervisor_name: undefined,
      media: undefined,
      employeeShifts: undefined,
      attendance: undefined,
      created_at: undefined,
      updated_at: undefined,
      attendancelogs: undefined,
      salary: undefined,
      department: undefined,
      designation: undefined,
      section: undefined,
      employeeType: undefined,
      shift: undefined,
      group_id: undefined,
      employeeHasAssets: undefined,
      supervisor: undefined,
      supervisor_name_format: undefined,
      employeeSection: undefined,
      group: undefined,
    };
    if (!this.date_of_birth) {
      delete result.date_of_birth;
    }
    if (!this.joining_date) {
      delete result.joining_date;
    }
    return result;
  }
}
