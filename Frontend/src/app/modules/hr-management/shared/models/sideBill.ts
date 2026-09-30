import { Deserializable } from '@app/shared/interfaces/deserializable';
import { Employee } from '@app/shared/model/employee';
import { Machine } from '@app/shared/model/machine';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import moment from 'moment';

export class SideBill implements Deserializable {
  id?: number;
  custom_id?: string = '';
  is_active?: boolean = true;
  employee_id?: number | null = null;
  machine_id?: number | null = null;
  machine_group_id?: number | null = null;
  current_working_machine_id?: number | null = null;
  side_working_machine_id?: number | null = null;
  side?: string | null = null;
  shift_id?: number | null = null;
  side_bill_date?: string | null = null;
  amount?: number | null = 0;
  note?: string = '';
  status?: string | null = null;
  employee?: Employee;
  machine?: Machine;
  shift?: EmployeeShift;
  currentWorkingMachine?: Machine;
  sideWorkingMachine?: Machine;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);

      if (input.employee) {
        this.employee = new Employee().deserialize(input.employee);
      }
      if (input.machine) {
        this.machine = new Machine().deserialize(input.machine);
      }
      if (input.shift) {
        this.shift = new EmployeeShift().deserialize(input.shift);
      }
      if (input.currentWorkingMachine) {
        this.currentWorkingMachine = new Machine().deserialize(input.currentWorkingMachine);
      }
      if (input.sideWorkingMachine) {
        this.sideWorkingMachine = new Machine().deserialize(input.sideWorkingMachine);
      }
    }

    return this;
  }

  toApi(): object {
    return {
      is_active: this.is_active,
      employee_id: this.employee_id,
      machine_id: this.machine_id,
      machine_group_id: this.machine_group_id,
      current_working_machine_id: this.current_working_machine_id,
      side_working_machine_id: this.side_working_machine_id,
      side: this.side,
      shift_id: this.shift_id,
      side_bill_date: this.side_bill_date
        ? moment(this.side_bill_date).format('YYYY-MM-DD')
        : null,
      amount: this.amount,
      note: this.note,
      status: this.status,
    };
  }
}
