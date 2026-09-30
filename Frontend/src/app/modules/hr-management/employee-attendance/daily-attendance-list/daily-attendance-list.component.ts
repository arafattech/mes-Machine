import { Component } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { Attendance } from '@app/modules/hr-management/shared/models/attendance';
import { Employee } from '@shared/model/employee';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import { Localization } from '@shared/utilities/localization';
import moment from 'moment';
import { getWorkedDuration } from '@app/modules/hr-management/shared/utilities/dateTime-format';

@Component({
  selector: 'app-daily-attendance-list',
  templateUrl: './daily-attendance-list.component.html',
  styleUrls: ['./daily-attendance-list.component.scss'],
})
export class DailyAttendanceListComponent {

  odata: boolean;
  loading = true;
  employees: Employee[] = [];
  public presentCount: number = 0;
  public absentCount: number = 0;
  seletedEmployee: Employee = new Employee().deserialize({});
  attendanceLogs: Attendance[] = [];
  dailyAttendance: Employee[] = [];
  filteredAttendance: any[] = [];
  employeeShifts: EmployeeShift[] = [];
  selectedShift: EmployeeShift = new EmployeeShift().deserialize({});
  shiftTitle = '';
  selectedDate: string = moment().format('YYYY-MM-DD');
  liveIntervals: { [employeeId: number]: any } = {};
  searchQuery = '';
  filterType: 'all' | 'present' | 'absent' = 'all';
  localization = Localization;
  headerTitle: string = `${this.localization.Employee} ${this.localization.Attendance} ${this.localization.Lists}`;
  departmentList: { id: number; name: string }[] = [];
  selectedDepartmentId: number | null = null;
  selectedShiftId: any;
  deptTitle: string = '';

  isOvertimeModalOpen: boolean = false;
  selectedAttendanceLogId: number | null = null;
  selectedEmployeeData: any = null;
  hasRoster: boolean = true;

  constructor(private commonService: CommonService) {
    this.odata = this.commonService.odata;
  }

  ngOnInit() {
    this.getDepartments();
    this.getEmployeeShifts();

  }

  ngOnDestroy() {
    Object.values(this.liveIntervals).forEach((interval) =>
      clearInterval(interval),
    );
  }

  getDepartments() {
    this.commonService.get(`Departments`, this.odata).subscribe({
      next: (res: any) => {
        this.departmentList = res.value.map((item: any) => ({
          id: item.id,
          name: item.name,
        }));
      },
      error: (err) => console.error('Error fetching departments:', err),
    });
  }

  onChangeDepertment(event: any) {
    const selectedItem = event.detail.item;
    if (selectedItem) {
      this.deptTitle = selectedItem.text;
      this.selectedDepartmentId = Number(selectedItem.id);
    } else {
      this.deptTitle = '';
      this.selectedDepartmentId = null;
    }
    this.applyFilters();
  }

  getEmployeeShifts() {
    this.commonService
      .get(`EmployeeShifts?$filter=is_active eq true`, this.odata)
      .subscribe({
        next: (response: any) => {
          this.employeeShifts = response.value.map((item: any) =>
            new EmployeeShift().deserialize(item),
          );

          if (this.employeeShifts.length > 0) {
            const now = moment();

            for (const shift of this.employeeShifts) {
              const start = moment(shift.start_time, 'hh:mm A');

              const end = moment(shift.end_time, 'hh:mm A');

              if (end.isBefore(start)) {
                end.add(1, 'day');
              }

              if (now.isBetween(start, end)) {
                this.selectedShift = shift;

                break;
              }
            }

            this.shiftTitle = this.selectedShift.name;
          }

          this.selectedShiftId = this.selectedShift.id;
          this.loadDailyAttendance();
        },

        error: (err) => console.error(err),
      });
  }

  onShiftChange(event: any) {
    const selectedItem = event.detail.item;

    this.shiftTitle = selectedItem?.text || '';

    if (selectedItem) {
      const shift = this.employeeShifts.find(
        (shift) => shift.id === Number(selectedItem.id),
      );

      if (shift) {
        this.selectedShift = shift;

        this.selectedShiftId = shift.id;
      } else {
        this.selectedShiftId = null;
      }
    } else {
      this.shiftTitle = '';

      this.selectedShiftId = null;
    }

    this.loadDailyAttendance();

    this.applyFilters();
  }

  onDateChange(event: any) {
    const selected = event.target.value;
    if (!selected) return;

    const formattedDate = moment(selected, 'DD-MM-YYYY').format('YYYY-MM-DD');
    this.selectedDate = formattedDate;
    this.loadDailyAttendance();
  }

  prepareAttendance(item: any, employee: Employee): Attendance {
    const attendance = new Attendance().deserialize({
      id: item.attendance_log_id,
      attendance_date: item.attendance_date,
      check_in_time: item.check_in_time,
      check_out_time: item.check_out_time,
      attendance_status: item.attendance_status,
      absent_type: item.absent_type,
      shift: item.shift,
      has_overtime: item.has_overtime,
      overtime_minutes: item.overtime_minutes,
      overtime_hours: item.over_time,
    });

    if (attendance.check_in_time) {
      if (!attendance.check_out_time) {
        this.startLiveTimer(employee);
      } else {
        attendance.totalHours = getWorkedDuration(
          attendance.check_in_time,
          attendance.check_out_time,
        );
      }
    }

    return attendance;
  }

  prepareEmployeeAttendance(res: any) {
    this.hasRoster = Boolean(res.has_roster);
    this.dailyAttendance = res.attendance.map((item: any) => {
      const employee = new Employee().deserialize({
        employee_no: item.employee_no,
        first_name: item.first_name,
        last_name: item.last_name,
        shift_id: item.default_shift_id,
        department_id: item.department_id,
        department: item.department,
        group_id: item.group_id,
        group: item.group_name,
      });

      employee.attendancelogs = [this.prepareAttendance(item, employee)];

      const attendance = employee.attendancelogs?.[0];
      if (attendance?.check_in_time && !attendance?.check_out_time) {
        this.startLiveTimer(employee);
      }

      return employee;
    });
  }

  loadDailyAttendance() {
    this.loading = true;
    this.liveIntervals = {};

    const shiftParam = this.selectedShiftId
      ? `&shift_id=${this.selectedShiftId}`
      : '';
    const url = `hrm/dailyAttendance?date=${this.selectedDate}${shiftParam}`;

    this.commonService.get(url, false).subscribe({
      next: (res: any) => {
        this.prepareEmployeeAttendance(res);
        this.applyFilters();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading attendance:', err);
        this.dailyAttendance = [];
        this.filteredAttendance = [];
        this.hasRoster = true;
        this.loading = false;
      },
    });
  }

  isAbsent(record: any): boolean {
    const status = record?.attendancelogs?.[0]?.attendance_status;
    return status ? status.toLowerCase() === 'absent' : false;
  }

  onSearchChange(event: any) {
    this.searchQuery = event.target.value.toLowerCase();
    this.applyFilters();
  }

  onFilterChange(type: 'all' | 'present' | 'absent') {
    this.filterType = type;
    this.applyFilters();
  }

  applyFilters() {
    const search = this.searchQuery.toLowerCase();
    this.filteredAttendance = this.dailyAttendance.filter((employee) => {
      const name = `${employee.first_name || ''} ${
        employee.last_name || ''
      }`.toLowerCase();
      const id = employee.custom_id ? String(employee.custom_id).toLowerCase() : '';
      const employeeNo = employee.employee_no
        ? String(employee.employee_no).toLowerCase()
        : '';
      const matchesSearch =
        employeeNo.includes(search) ||
        name.includes(search) ||
        id.includes(search) ||
        search === '';

      const attendanceStatus =
        employee.attendancelogs?.[0]?.attendance_status || 'absent';
      const matchesFilter =
        this.filterType === 'all' ||
        (this.filterType === 'present' && attendanceStatus === 'present') ||
        (this.filterType === 'absent' && attendanceStatus === 'absent');

      const matchesDepartment = this.selectedDepartmentId
        ? employee.department_id === this.selectedDepartmentId
        : true;

      return matchesSearch && matchesFilter && matchesDepartment;
    }).sort((a, b) => {
      const aTime = a.attendancelogs?.[0]?.check_in_time ?? '';
      const bTime = b.attendancelogs?.[0]?.check_in_time ?? '';
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    });
  }

  startLiveTimer(employee: Employee) {
    const attendance = employee.attendancelogs?.[0];
    if (!attendance || this.liveIntervals[employee.id!]) return;
    this.liveIntervals[employee.id!] = setInterval(() => {
      attendance.totalHours = getWorkedDuration(attendance.check_in_time);
    }, 1000);
  }

  stopLiveTimer(employee: Employee) {
    if (!this.liveIntervals[employee.id!]) return;

    clearInterval(this.liveIntervals[employee.id!]);
    delete this.liveIntervals[employee.id!];

    const attendance = employee.attendancelogs?.[0];
    if (attendance?.check_in_time) {
      attendance.totalHours = getWorkedDuration(
        attendance.check_in_time,
        attendance.check_out_time,
      );
    }
  }

  resetFilters() {
    this.searchQuery = '';
    this.filterType = 'all';
    this.deptTitle = '';
    this.selectedDepartmentId = null;
    this.selectedDate = moment().format('YYYY-MM-DD');
    this.shiftTitle = '';
    this.selectedShift = new EmployeeShift().deserialize({});
    this.selectedShiftId = null;
    this.loadDailyAttendance();
  }

  showOvertimeButton(record: any): boolean {
    const attendance = record?.attendancelogs?.[0];

    return Boolean(attendance?.id && this.isPresent(record));
  }

  isPresent(record: any): boolean {
    const status = record?.attendancelogs?.[0]?.attendance_status;

    return status?.toLowerCase() === 'present';
  }

  hasAssignedOvertime(record: any): boolean {
    return (
      this.isPresent(record) &&
      record?.attendancelogs?.[0]?.has_overtime === true
    );
  }

  canAssignOvertime(record: any): boolean {
    const attendance = record?.attendancelogs?.[0];

    return Boolean(
      attendance?.id &&
      this.isPresent(record) &&
      attendance?.check_in_time &&
      !attendance?.check_out_time &&
      !this.hasAssignedOvertime(record),
    );
  }

  isOvertimeButtonDisabled(record: any): boolean {
    return this.hasAssignedOvertime(record) || !this.canAssignOvertime(record);
  }

  onOvertimeSuccess(event: any) {
    if (event && this.selectedEmployeeData) {
      this.loadDailyAttendance();
    }
    this.isOvertimeModalOpen = false;
  }

  openOvertimeModal(record: any) {
    const attendanceLog = record.attendancelogs?.[0];
    if (!attendanceLog?.id) {
      return;
    }
    if (attendanceLog.attendance_status?.toLowerCase() !== 'present') {
      return;
    }
    if (!this.canAssignOvertime(record)) {
      return;
    }
    this.selectedAttendanceLogId = attendanceLog.id;
    this.selectedEmployeeData = record;
    this.isOvertimeModalOpen = true;
  }

  closeOvertimeModal() {
    this.isOvertimeModalOpen = false;
    this.selectedAttendanceLogId = null;
    this.selectedEmployeeData = null;
  }
}
