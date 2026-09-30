import { Deserializable } from '@app/shared/interfaces/deserializable';

export class EmployeeAttendance implements Deserializable {
  id?: number;
  is_active?: boolean = true;
  employee_no?: string;
  attendance_date?: string;
  check_in_time?: string;
  check_out_time?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this {
    if (input) {
      Object.assign(this, input);

      if (input.check_in_time && input.attendance_date) {
        this.check_in_time = this.formatDateTime(
          input.attendance_date,
          input.check_in_time
        );
      }
      if (input.check_out_time && input.attendance_date) {
        this.check_out_time = this.formatDateTime(
          input.attendance_date,
          input.check_out_time
        );
      }
    }
    return this;
  }

  private formatDateTime(dateStr: string, timeStr: string): string {
    let timePart = '';
    if (timeStr.includes('T')) {
      timePart = timeStr.split('T')[1].split('+')[0].split('Z')[0];
    } else if (timeStr.includes(' ')) {
      timePart = timeStr.split(' ')[1];
    } else {
      timePart = timeStr;
    }

    const combined = new Date(`${dateStr}T${timePart}`);

    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    };

    return combined.toLocaleString(undefined, options).replace(',', '');
  }

  toOdata(): Object {
    return {
      ...this,
      created_at: undefined,
      updated_at: undefined,
    };
  }
}
