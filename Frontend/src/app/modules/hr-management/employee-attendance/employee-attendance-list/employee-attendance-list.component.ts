import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { saveMode } from '@shared/enums/saveMode';
import { Attendance } from '@app/modules/hr-management/shared/models/attendance';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import moment from 'moment';
import { Permissions } from '@app/shared/enums/permissions';
import {
  calculateTotalHours,
  DateFormatterService,
} from '@app/shared/utilities/date-format';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarActionEvent,
  AgGridTableToolbarConfig,
  AgGridToolbarFilter,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import {
  calculateHoursFromMinutes,
  formatTime,
} from '@app/modules/hr-management/shared/utilities/dateTime-format';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import {
  AgGridDynamicColorBadgeComponent,
  AgGridStatusBadgeComponent,
} from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';

@Component({
  selector: 'app-employee-attendance-list',
  templateUrl: './employee-attendance-list.component.html',
  styleUrl: './employee-attendance-list.component.scss',
})
export class EmployeeAttendanceListComponent implements OnChanges {

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  @Input() isNewAttendanceButtonVisible: boolean = true;
  @Input() apiUrl: string = '';
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  localization = Localization;
  insertTitle: string = $localize`New`;
  headerTitle: string = `${this.localization.Attendance} ${this.localization.Lists}`;

  odata: boolean;
  Attendance = Attendance;
  attendance = new Attendance();
  saveModeEnum = saveMode;
  saveMode: saveMode = saveMode.POST;
  open: boolean = false;
  loading: boolean = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  validationMessage = Localization.requiredField;
  isHoliday: boolean = false;
  isOnApprovedLeave: boolean = false;
  showShiftError: boolean = false;
  checkinShiftName: string = '';
  valueStateOptions = {
    employee: ValueState.None,
    attendance_date: ValueState.None,
    check_in_time: ValueState.None,
  };
  shifts: EmployeeShift[] = [];
  public employeeTitle = '';
  isSubmitable: boolean = false;
  columns: AgGridTableColumn<any>[] = [];
  permissions = Permissions;

  public dateRangeValue = '';
  public dateRangeFilter = '';
  public employeeTypeFilter = '';
  public employeeTypeToolbarFilters: AgGridToolbarFilter[] = [];
  public selectedEmployeeTypeId = '';
  public selectedEmployeeTypeName = '';
  private employeeTypeNameById = new Map<string, string>();
  public IsExportXls = new EventEmitter<void>();

  dataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'AttendanceLogs',
    expand: 'employee($expand=employeeType),shift',
    sortDirection: 'desc',
    pageSize: 50,
    sortBy: 'attendance_date',
    searchFields: [
      'employee.employee_no',
      'employee.first_name',
      'employee.last_name',
      'shift.name',
    ],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: this.headerTitle,
    addButtonText: this.insertTitle,
    showSearch: true,
    showRowCount: true,
    showNewButton:
      this.rolePermissionService.hasPermission(
        this.permissions.HR_ATTENDANCE_CREATE,
      ) && this.isNewAttendanceButtonVisible,
    showDownload:
      this.rolePermissionService.hasPermission(
        this.permissions.HR_ATTENDANCE_EXPORT,
      ) && this.isNewAttendanceButtonVisible,
    showScanner: false,
    showSegmentButton: false,
    showResetButton: true,
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    private commonService: CommonService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
  ) {
    this.odata = this.commonService.odata;
    this.columns = this.buildColumns();
    const today = moment();
    const thirtyDaysAgo = moment().subtract(29, 'days');
    this.dateRangeValue = `${thirtyDaysAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateCondition(thirtyDaysAgo, today);
    this.rebuildFilter();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isNewAttendanceButtonVisible'] || changes['apiUrl']) {
      const isMain = this.isNewAttendanceButtonVisible;
      this.dataSource = {
        ...this.dataSource,
        endpoint: isMain ? 'AttendanceLogs' : this.apiUrl,
        expand: isMain ? 'employee($expand=employeeType),shift' : '',
        filter: isMain ? this.dateRangeFilter : undefined,
        searchFields: isMain
          ? [
              'employee.employee_no',
              'employee.first_name',
              'employee.last_name',
              'shift.name',
            ]
          : [],
      };
      this.toolbarConfig = {
        ...this.toolbarConfig,
        showNewButton:
          this.rolePermissionService.hasPermission(
            this.permissions.HR_ATTENDANCE_CREATE,
          ) && isMain,
        showDownload: isMain,
      };
    }
  }

  ngOnInit(): void {
    this.getShift();
    // Type-filter dropdown only backs the "New Attendance" form's toolbar
    // filter — skip fetching it in read-only/embedded views (e.g. a single
    // employee's attendance log on their dashboard).
    if (this.isNewAttendanceButtonVisible) {
      this.getEmployeeTypes();
    }
  }

  resetFilters(): void {
    const today = moment();
    const thirtyDaysAgo = moment().subtract(29, 'days');
    this.dateRangeValue = `${thirtyDaysAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateCondition(thirtyDaysAgo, today);
    this.employeeTypeFilter = '';
    this.selectedEmployeeTypeId = '';
    this.selectedEmployeeTypeName = '';
    this.rebuildFilter();
    this.agGridRef?.clearSearch();
  }

  private buildDateCondition(start: moment.Moment, end: moment.Moment): string {
    return `attendance_date ge ${start.format('YYYY-MM-DD')} and attendance_date le ${end.format('YYYY-MM-DD')}`;
  }

  private rebuildFilter(): void {
    const parts = [this.dateRangeFilter, this.employeeTypeFilter].filter(Boolean);
    this.dataSource = { ...this.dataSource, filter: parts.join(' and ') };
  }

  onDateRangeStringChange(value: string): void {
    if (!value || !value.includes(' - ')) return;
    const [from, to] = value.split(' - ');
    const start = moment(from, 'DD/MM/YYYY');
    const end = moment(to, 'DD/MM/YYYY');
    if (!start.isValid() || !end.isValid()) return;
    this.dateRangeValue = value;
    this.dateRangeFilter = this.buildDateCondition(start, end);
    this.rebuildFilter();
  }

  getEmployeeTypes(): void {
    this.commonService
      .get('EmployeeTypes?$filter=is_active eq true', this.odata)
      .subscribe({
        next: (res: any) => {
          const options = (res.value ?? []).map((employeeType: any) => ({
            value: String(employeeType.id),
            label: employeeType.name,
          }));
          this.employeeTypeNameById = new Map(
            options.map((option: { value: string; label: string }) => [option.value, option.label]),
          );
          this.employeeTypeToolbarFilters = options.length
            ? [{
                id: 'employee_type',
                type: 'select',
                placeholder: $localize`Filter by Employee Type`,
                clearLabel: $localize`All`,
                options,
              }]
            : [];
        },
        error: (err) => {
          console.error('Error fetching employee types:', err);
        },
      });
  }

  onToolbarAction(event: AgGridTableToolbarActionEvent): void {
    console.log('Toolbar action event:', event);
    if (event.actionId !== 'filter:employee_type') return;
    this.selectedEmployeeTypeId = event.value ? String(event.value) : '';
    this.selectedEmployeeTypeName = this.employeeTypeNameById.get(this.selectedEmployeeTypeId) ?? '';
    this.employeeTypeFilter = this.selectedEmployeeTypeId
      ? `employee_type_id eq ${this.selectedEmployeeTypeId}`
      : '';
    this.rebuildFilter();
  }

  getAttendanceExportPayload(): { from: string; to: string; employee_type_id: string; employee_type_name: string } {
    const [from, to] = this.dateRangeValue.split(' - ');
    return {
      from: moment(from, 'DD/MM/YYYY').format('YYYY-MM-DD'),
      to: moment(to, 'DD/MM/YYYY').format('YYYY-MM-DD'),
      employee_type_id: this.selectedEmployeeTypeId,
      employee_type_name: this.selectedEmployeeTypeName,
    };
  }

  getAttendanceExportFileName(): string {
    const { from, to } = this.getAttendanceExportPayload();
    const typeSegment = this.selectedEmployeeTypeName
      ? `_${this.selectedEmployeeTypeName.replace(/\s+/g, '_')}`
      : '';
    return `${from}-to-${to}${typeSegment}_attendance.xlsx`;
  }

  exportAttendances(): void {
    this.IsExportXls.emit();
  }

  employeeLabelFn = (item: any) =>
    `${item.employee_no} - ${item.first_name} ${item.last_name || ''}`.trim();

  onServerEmployeeChange(item: any) {
    if (this.saveMode === saveMode.PUT || !item) {
      return;
    }

    this.attendance.employee_id = item.id;
    this.employeeTitle = this.employeeLabelFn(item);
    this.checkValidation({ target: { value: this.employeeTitle } }, 'employee');
  }

  normalizeAttendanceDate(value: string): string {
    const parsedDate = moment(
      value,
      ['YYYY-MM-DD', 'MMM D, YYYY', 'DD-MM-YYYY'],
      true,
    );

    return parsedDate.isValid()
      ? parsedDate.format('YYYY-MM-DD')
      : moment(value).format('YYYY-MM-DD');
  }

  onAttendanceDateChange(event: any) {
    this.loading = true;
    const rawDateValue = event.detail?.value || event.target?.value || '';

    if (!rawDateValue) {
      this.loading = false;
      return;
    }

    const selectedDate = this.normalizeAttendanceDate(rawDateValue);
    const employeeId = this.attendance.employee_id;

    if (!employeeId) {
      this.loading = false;
      return;
    }

    this.commonService
      .get(
        `hrm/employees/${employeeId}/attendance-check?date=${selectedDate}`,
        false,
      )
      .subscribe({
        next: (res: any) => {
          this.loading = false;
          this.attendance.attendance_date = selectedDate;
          this.isHoliday = res.isHoliday;
          this.isOnApprovedLeave = res.isOnApprovedLeave;
          this.isSubmitable = res.canSubmit;

          if (
            this.saveMode === saveMode.POST &&
            this.attendance.check_in_time
          ) {
            this.isSubmitable = false;
            this.attendance.check_in_time = '';
            this.showShiftError = false;
          }
        },
        error: (err) => {
          console.error('Attendance date check error', err);
          this.loading = false;
        },
      });
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'employee.employee_no',
        headerName: $localize`Employee No`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? '',
      },
      {
        colId: 'employee.first_name',
        headerName: $localize`First Name`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.first_name ?? '',
      },
      {
        colId: 'employee.last_name',
        headerName: $localize`Last Name`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.last_name ?? '',
      },
      {
        colId: 'employee.employeeType.name',
        headerName: $localize`Emp Type`,
        minWidth: 120,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) => params.data?.employee?.employeeType?.name ?? '',
      },
            {
        colId: 'is_ot',
        headerName: $localize`Type`,
        minWidth: 110,
        sortable: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (params: any) => (params.data?.is_ot ? 'EXTRA' : 'REGULAR'),
        filterControl: {
          type: 'multiSelect',
          options: [
            { value: '0', label: 'REGULAR' },
            { value: '1', label: 'EXTRA' },
          ],
        },
      },
      {
        field: 'attendance_date',
        headerName: $localize`Attendance Date`,
        minWidth: 140,
        filter: false,
        floatingFilter: false,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(
                value,
                true,
                false,
                false,
                false,
                false,
              )
            : '',
      },
      {
        field: 'check_in_time',
        headerName: $localize`Check-In Time`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        valueFormatter: (params: any) =>
          params.value
            ? this.dateFormatter.formatDate(
                params.value,
                false,
                true,
                true,
                true,
                true,
                true,
              )
            : '',
      },
      {
        field: 'check_out_time',
        headerName: $localize`Check-Out Time`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        valueFormatter: (params: any) =>
          params.value
            ? this.dateFormatter.formatDate(
                params.value,
                false,
                true,
                true,
                true,
                true,
                true,
              )
            : '',
      },
      {
        colId: 'working_hour',
        headerName: $localize`Working Hour`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        sortable: false,
        valueGetter: (params: any) =>
          calculateTotalHours(
            params.data?.check_in_time,
            params.data?.check_out_time,
          ),
      },
      {
        colId: 'shift.name',
        headerName: $localize`Shift`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.shift?.name ?? '',
        cellRenderer: AgGridDynamicColorBadgeComponent,
        cellRendererParams: {
          colorAccessor: (data: any) => data?.shift?.color,
        },
        filterControl: {
          type: 'multiSelect',
          options: this.shifts.map((filter) => ({
            value: filter.name,
            label: filter.name,
          })),
        },
      },
      {
        field: 'status',
        headerName: $localize`Status`,
        minWidth: 100,
        cellRenderer: AgGridStatusBadgeComponent,
        filterControl: {
          type: 'multiSelect',
          options: [
            { value: 'VALID', label: 'VALID' },
            { value: 'LATE', label: 'LATE' },
            { value: 'INVALID', label: 'INVALID' },
          ],
        },
      },

      {
        colId: 'overtime',
        headerName: $localize`Overtime`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        sortable: false,
        valueGetter: (params: any) => {
          return calculateHoursFromMinutes(params.data?.overtime_minutes, params.data?.over_time || '0h 0m');
        },
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
    ];
  }

  newAttendance() {
    this.attendance = new Attendance().deserialize({});
    this.employeeTitle = '';
    this.saveMode = saveMode.POST;
    this.open = true;
  }

  editAttendance(data: any) {
    this.attendance = new Attendance().deserialize(data);
    this.saveMode = saveMode.PUT;
    if (saveMode.PUT) {
      this.isSubmitable = true;
    }
    this.open = true;
    this.attendance.employee_id = data.employee_id ?? data.employee?.id;
    this.employeeTitle = data.employee
      ? `${data.employee.employee_no} - ${data.employee.first_name} ${data.employee.last_name ?? ''}`.trim()
      : '';
    this.attendance.check_in_time =
      formatTime(data.check_in_time) || this.attendance.check_in_time || '';
    this.attendance.check_out_time =
      formatTime(data.check_out_time) || this.attendance.check_out_time || '';
  }

  // No blocking wall — the resolved shift (or lack of one) is always recorded,
  // with a status of VALID/LATE/INVALID; submit stays enabled either way. The
  // message strip is purely informational, always showing the resolved shift
  // name with its status (Valid/Late/Invalid) so the user knows what got
  // recorded, never a hard stop.
  onCheckInResponse(res: any) {
    this.attendance.shift_id = res.shift?.id ?? undefined;
    this.attendance.status = res.status ?? 'INVALID';
    this.checkinShiftName = res.shift?.name ?? '';
    this.showShiftError = true;
    this.isSubmitable = true;
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : '';

    switch (field) {
      case 'employee':
        if (!value.trim()) {
          this.valueStateOptions.employee = ValueState.Negative;
        } else {
          this.attendance.employee = value;
          this.valueStateOptions.employee = ValueState.None;
        }
        break;

      case 'attendance_date':
        if (!value.trim()) {
          this.valueStateOptions.attendance_date = ValueState.Negative;
        } else {
          this.attendance.attendance_date = this.normalizeAttendanceDate(value);
          this.valueStateOptions.attendance_date = ValueState.None;
        }
        break;

      case 'check_in_time':
        if (!value.trim()) {
          this.valueStateOptions.check_in_time = ValueState.Negative;
          this.attendance.check_in_time = '';
          this.isSubmitable = false;
          return;
        }

        this.attendance.check_in_time = value;
        this.valueStateOptions.check_in_time = ValueState.None;

        const employeeId = this.attendance.employee_id;
        const attendanceDate = this.attendance.attendance_date;

        if (!employeeId) {
          this.checkinShiftName = '';
          this.showShiftError = true;
          this.isSubmitable = false;
          return;
        }
        if (!attendanceDate) {
          this.checkinShiftName = '';
          this.showShiftError = true;
          this.isSubmitable = false;
          return;
        }

        this.loading = true;
        this.commonService
          .get(
            `hrm/employees/${employeeId}/validate-checkin?date=${attendanceDate}&time=${value}`,
            false,
          )
          .subscribe({
            next: (res: any) => {
              this.loading = false;
              this.onCheckInResponse(res);
            },
            error: (err: any) => {
              console.error('validate-checkin error', err);
            },
          });
        break;

      default:
        break;
    }
  }

  getShift() {
    this.commonService
      .get('EmployeeShifts?$filter=is_active eq true', this.odata)
      .subscribe({
        next: (res: any) => {
          this.shifts = res.value ?? [];
          this.columns = this.buildColumns();
        },
      });
  }
  validateForm(): boolean {
    let isValid = true;

    if (!this.attendance.employee_id) {
      this.valueStateOptions.employee = ValueState.Negative;
      isValid = false;
    }
    if (!this.attendance.attendance_date?.trim()) {
      this.valueStateOptions.attendance_date = ValueState.Negative;
      isValid = false;
    }
    if (!this.attendance.check_in_time?.trim()) {
      this.valueStateOptions.check_in_time = ValueState.Negative;
      isValid = false;
    }

    return isValid;
  }

  saveAttendance() {
    if (!this.validateForm()) return;

    this.loading = true;
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST) {
      url = 'AttendanceLogs';
      this.ToastType = 'add';
      request$ = this.commonService.post(url, this.attendance.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `hrm/attendance/${this.attendance.id}/checkout`;
      this.ToastType = 'edit';

      const payload = {
        attendance_date: this.attendance.attendance_date,
        check_in_time: this.attendance.check_in_time,
        shift_id: this.attendance.shift_id,
        check_out_time: this.attendance.check_out_time,
      };

      request$ = this.commonService.put(url, payload, false);
    }

    if (request$) {
      request$.subscribe({
        next: (res) => {
          this.refreshTable.emit();
          this.refreshAttendanceTable();
          this.closeDialog();
          this.toastService.show(this.ToastType);
        },
        error: (err) => {
          console.error(err);
          this.closeDialog();
          this.toastService.show('error');
        },
      });
    }
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.employeeTitle = '';
    this.valueStateOptions.employee = ValueState.None;
    this.valueStateOptions.attendance_date = ValueState.None;
    this.valueStateOptions.check_in_time = ValueState.None;
    this.isHoliday = false;
    this.showShiftError = false;
    this.checkinShiftName = '';
    this.isOnApprovedLeave = false;
    this.isSubmitable = false;
    this.attendance = new Attendance().deserialize({});
  }

  onDeleteSuccess() {
    this.refreshTable.emit();
    this.refreshAttendanceTable();
  }

  refreshAttendanceTable() {
    setTimeout(() => {
      this.agGridRef?.refreshGridData(true);
    });
  }

}
