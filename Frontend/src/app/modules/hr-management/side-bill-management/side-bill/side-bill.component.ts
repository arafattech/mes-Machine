import {
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { SharedModule } from '@app/shared/shared.module';
import { Permissions } from '@app/shared/enums/permissions';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import { ValueState } from '@shared/utilities/value-state-wrapper';
import { SideBill } from '@app/modules/hr-management/shared/models/sideBill';
import { Employee } from '@app/shared/model/employee';
import { Machine } from '@app/shared/model/machine';
import { EmployeeShift } from '@app/modules/hr-management/shared/models/employeeShift';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridStatusBadgeComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import moment from 'moment';

@Component({
  selector: 'app-side-bill',
  standalone: true,
  imports: [SharedModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './side-bill.component.html',
  styleUrl: './side-bill.component.scss',
})
export class SideBillComponent {
  @Output() IsDelete = new EventEmitter<any>();
  @Output() IsExportXls: EventEmitter<void> = new EventEmitter<void>();
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @ViewChild('sideBillTableRef') sideBillTableRef?: AgGridTableComponent<any>;
  @ViewChild('payModeEmployeeTableRef')
  payModeEmployeeTableRef?: AgGridTableComponent<any>;
  @ViewChild('confirmPayTableRef')
  confirmPayTableRef?: AgGridTableComponent<any>;

  private readonly switchStorageKey = 'side-bill-pay-mode';

  public permissions = Permissions;
  public localization = Localization;
  public saveMode: string = saveMode.POST;
  public insertTitle = `${this.localization.New}`;
  public headerTitle = $localize`Side Bill`;
  public sideBill = new SideBill().deserialize({});
  public open = false;
  public loading = false;
  public ToastType: 'add' | 'edit' | 'error' = 'add';
  public validationMessage = Localization.requiredField;
  public readonly sideOptions: string[] = ['LEFT', 'RIGHT'];

  public valueStateOptions = {
    employee_id: ValueState.None,
    machine_group_id: ValueState.None,
    amount: ValueState.None,
    side: ValueState.None,
  };
  public employees: Employee[] = [];
  public machines: Machine[] = [];
  public machineGroups: any[] = [];
  public filteredMachines: Machine[] = [];
  public employeeName = '';
  public machineGroupName = '';
  public currentWorkingMachineName = '';
  public sideWorkingMachineName = '';
  public shifts: EmployeeShift[] = [];
  public shiftName = '';
  public isRingMachine = false;
  public isAutoconMachine = false;
  public columns: AgGridTableColumn<any>[] = this.tableColumns();
  public payModeEmployeeColumns: AgGridTableColumn<any>[] =
    this.buildPayModeEmployeeColumns();
  public confirmPayColumns: AgGridTableColumn<any>[] =
    this.buildConfirmPayColumns();

  public dateRangeValue: string;
  public dateRangeFilter: string;
  public mainTableFilter: string;

  public payMode = false;
  public selectedPayEmployee: any = null;
  public payModeEmployeeId: number | null = null;
  public payModeSelectedRows: any[] = [];
  public markPaidRows: any[] = [];
  public payModeEmployeeRowIndexes: Record<number, boolean> = {};
  private _payModeAutoSelected = false;

  public isMarkPaidDialogOpen = false;
  public markPaidTotal = 0;
  public confirmPayTableData: any[] = [];
  public isConfirmPayLoading = false;

  public isViewDialogOpen = false;
  public viewSideBill: any = null;

  // Pay-mode employee picker — only employees who actually have a side bill, derived
  // from SideBills (deduped client-side), never a direct Employees fetch.
  public payModeEmployeeDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  public payModeEmployeeToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Employees`,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };

  public payModeEmployeeDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 98px)',
  };

  public sideBillDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'SideBills',
    pageSize: 50,
    expand: 'employee($expand=employeeSection),shift,machineGroup,currentWorkingMachine,sideWorkingMachine',
    searchFields: [
      'custom_id',
      'employee.employee_no',
      'employee.first_name',
      'employee.last_name',
      'shift.name',
      'machineGroup.name',
      'currentWorkingMachine.machine_name',
      'sideWorkingMachine.machine_name',
      'amount',
      'status',
      'note',
    ],
  };

  public get sideBillToolbarConfig(): AgGridTableToolbarConfig {
    return {
      headerTitle: this.headerTitle,
      addButtonText: $localize`New`,
      showSearch: true,
      showRowCount: true,
      showNewButton:
        !this.payMode &&
        this.permission.hasPermission(this.permissions.HR_SIDE_BILL_CREATE),
      showDownload: true,
      showScanner: false,
      showSegmentButton: !this.payMode,
      button1Text: $localize`All`,
      button2Text: $localize`Active`,
      button3Text: $localize`Inactive`,
    };
  }

  public sideBillDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  public confirmPayToolbarConfig: AgGridTableToolbarConfig = {
    showSearch: false,
    showRowCount: false,
    showNewButton: false,
    showDownload: false,
    showSegmentButton: false,
  };

  public confirmPayDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '380px',
  };

  get hasPayModeSelection(): boolean {
    return this.payModeSelectedRows.some((row: any) => !this.isRowPaid(row));
  }

  payModeActionButtons: AgGridCustomButton[] = [];

  get sideBillIsPaid(): boolean {
    return this.sideBill.status === 'PAID';
  }

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    public permission: RolePermissionService,
  ) {
    const today = moment();
    const sevenDaysAgo = moment().subtract(6, 'days');
    this.dateRangeValue = `${sevenDaysAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateCondition(sevenDaysAgo, today);
    this.mainTableFilter = this.dateRangeFilter;
    this.sideBillDataSource = {
      ...this.sideBillDataSource,
      filter: this.mainTableFilter,
    };
    this.restoreSwitchState();
    this.loadPayModeEmployees();
  }

  // Derives the pay-mode employee picker from SideBills instead of querying Employees
  // directly — only employees who have at least one side bill should be selectable.
  private loadPayModeEmployees(): void {
    this.commonService
      .get('SideBills?$expand=employee($expand=employeeSection,employeeType)&$top=1000', true)
      .subscribe({
        next: (res: any) => {
          const seen = new Set<number>();
          const employees: any[] = [];
          (res.value ?? []).forEach((row: any) => {
            const emp = row.employee;
            if (!emp || seen.has(emp.id)) return;
            seen.add(emp.id);
            employees.push(emp);
          });
          this.payModeEmployeeDataSource = { ...this.payModeEmployeeDataSource, data: employees };
          this.onPayModeEmployeeDataLoaded(employees.length);
        },
        error: (err) => console.error(err),
      });
  }

  private buildDateCondition(start: moment.Moment, end: moment.Moment): string {
    const from = start.clone().startOf('day').toISOString();
    const to = end.clone().endOf('day').toISOString();
    return `side_bill_date ge ${from} and side_bill_date le ${to}`;
  }

  private rebuildMainTableFilter(): void {
    const parts: string[] = [];
    if (this.dateRangeFilter) parts.push(this.dateRangeFilter);
    if (this.payMode && this.payModeEmployeeId) {
      parts.push(`employee_id eq ${this.payModeEmployeeId}`);
    }
    this.mainTableFilter = parts.join(' and ');
    this.sideBillDataSource = {
      ...this.sideBillDataSource,
      filter: this.mainTableFilter,
    };
  }

  onDateRangeChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.onDateRangeStringChange(input?.value);
  }

  onDateRangeStringChange(value: string): void {
    if (!value || !value.includes(' - ')) return;
    const [from, to] = value.split(' - ');
    const start = moment(from, 'DD/MM/YYYY');
    const end = moment(to, 'DD/MM/YYYY');
    if (!start.isValid() || !end.isValid()) return;
    this.dateRangeValue = value;
    this.dateRangeFilter = this.buildDateCondition(start, end);
    this.rebuildMainTableFilter();
  }

  onMainSwitchChange(checked: boolean) {
    this.payMode = !!checked;
    this.persistSwitchState();

    if (!this.payMode) {
      this.selectedPayEmployee = null;
      this.payModeEmployeeId = null;
      this.payModeSelectedRows = [];
      this.markPaidRows = [];
      this.payModeEmployeeRowIndexes = {};
      this.sideBillTableRef?.clearSelection();
      this.updatePayModeButtons();
    } else {
      this._payModeAutoSelected = false;
    }

    this.rebuildMainTableFilter();

    if (this.payMode) {
      setTimeout(() => {
        this.payModeEmployeeTableRef?.getGridApi()?.sizeColumnsToFit();
        const api = this.payModeEmployeeTableRef?.getGridApi();
        const firstNode = api?.getDisplayedRowAtIndex(0);
        if (firstNode?.data && !this._payModeAutoSelected) {
          this._payModeAutoSelected = true;
          firstNode.setSelected(true);
          this.onPayEmployeeSelect(firstNode.data);
        }
      }, 250);
    }
  }

  private persistSwitchState(): void {
    try {
      window.localStorage.setItem(this.switchStorageKey, String(this.payMode));
    } catch {}
  }

  private restoreSwitchState(): void {
    try {
      this.payMode =
        window.localStorage.getItem(this.switchStorageKey) === 'true';
    } catch {
      this.payMode = false;
    }
  }

  onPayEmployeeSelect(event: any) {
    if (!event?.id) return;
    this.selectedPayEmployee = event;
    this.payModeEmployeeId = event.id ?? null;
    this.payModeSelectedRows = [];
    this.markPaidRows = [];
    this.sideBillTableRef?.clearSelection();
    this.updatePayModeButtons();
    this.rebuildMainTableFilter();
  }

  onPayModeEmployeeDataLoaded(count: number): void {
    if (!this.payMode || this._payModeAutoSelected || !count) return;
    this._payModeAutoSelected = true;
    setTimeout(() => {
      const api = this.payModeEmployeeTableRef?.getGridApi();
      const firstNode = api?.getDisplayedRowAtIndex(0);
      if (!firstNode?.data) return;
      firstNode.setSelected(true);
      this.onPayEmployeeSelect(firstNode.data);
    }, 0);
  }

  onSideBillSelectionChanged(rows: any[]): void {
    if (!this.payMode) return;
    this.payModeSelectedRows = rows;
    this.updatePayModeButtons();
  }

  private updatePayModeButtons(): void {
    const hasUnpaid = this.payModeSelectedRows.some((row: any) => !this.isRowPaid(row));
    if (this.payMode && hasUnpaid) {
      this.payModeActionButtons = [{
        id: 'mark-paid',
        text: $localize`Mark as Paid`,
        icon: 'accept',
        design: 'Emphasized',
      }];
    } else {
      this.payModeActionButtons = [];
    }
  }

  handlePayModeTableData(_event: any) {
    // no-op — ag-grid data is managed via URL/filter binding
  }

  tableColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
        floatingFilter: false,
      },
      {
        field: 'custom_id',
        headerName: $localize`ID`,
        minWidth: 110,
        sort: 'desc',
      },
      {
        colId: 'employee_no',
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
        colId: 'employee.employeeSection.name',
        headerName: $localize`Section`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employee?.employeeSection?.name ?? '',
      },
      {
        colId: 'shift.name',
        headerName: $localize`Shift`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.shift?.name ?? '',
      },
      {
        colId: 'machineGroup.name',
        headerName: $localize`Machine Group`,
        minWidth: 140,
        valueGetter: (params: any) => params.data?.machineGroup?.name ?? '',
      },
      {
        colId: 'currentWorkingMachine.name',
        headerName: $localize`Current Machine`,
        minWidth: 140,
        valueGetter: (params: any) => params.data?.currentWorkingMachine?.machine_name ?? '',
      },
      {
        colId: 'sideWorkingMachine.name',
        headerName: $localize`Side Machine`,
        minWidth: 140,
        valueGetter: (params: any) => params.data?.sideWorkingMachine?.machine_name ?? '',
      },
      {
        field: 'amount',
        headerName: $localize`Amount`,
        minWidth: 110,
        type: 'numericColumn',
      },
      {
        field: 'side_bill_date',
        headerName: $localize`Bill Date`,
        minWidth: 120,
      },
      { field: 'status', headerName: $localize`Status`, minWidth: 110, cellRenderer: AgGridStatusBadgeComponent },
      { field: 'note', headerName: $localize`Note`, minWidth: 150 },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
      },
    ];
  }

  buildPayModeEmployeeColumns(): AgGridTableColumn<any>[] {
    return [
      { field: 'employee_no', headerName: $localize`Emp No`, minWidth: 120 },
      { field: 'first_name', headerName: $localize`First Name`, minWidth: 130 },
      { field: 'last_name', headerName: $localize`Last Name`, minWidth: 130 },
      {
        colId: 'section_name',
        headerName: $localize`Section`,
        minWidth: 130,
        valueGetter: (params: any) => params.data?.employeeSection?.name ?? '',
      },
      {
        colId: 'employee_type.name',
        headerName: $localize`Employee Type`,
        minWidth: 140,
        valueGetter: (params: any) => params.data?.employeeType?.name ?? '',
      },
    ];
  }

  buildConfirmPayColumns(): AgGridTableColumn<any>[] {
    return [
      {
        colId: 'emp_no',
        headerName: $localize`Emp No`,
        minWidth: 120,
        valueGetter: (params: any) => params.data?.employee?.employee_no ?? '',
      },
      {
        colId: 'employee_name',
        headerName: $localize`Employee Name`,
        minWidth: 160,
        valueGetter: (params: any) => {
          const e = params.data?.employee;
          return e ? `${e.first_name || ''} ${e.last_name || ''}`.trim() : '-';
        },
      },
      {
        colId: 'machine_name',
        headerName: $localize`Machine`,
        minWidth: 140,
        valueGetter: (params: any) => params.data?.machine?.machine_name ?? '',
      },
      {
        field: 'amount',
        headerName: $localize`Amount`,
        minWidth: 110,
        type: 'numericColumn',
      },
    ];
  }

  private employeeSearchTimer: ReturnType<typeof setTimeout> | null = null;
  public isEmployeeSearchLoading = false;

  initEmployees(search?: string) {
    const term = search?.trim().toLowerCase();
    const searchFilter = term
      ? ` and (contains(tolower(employee_no),'${term}') or contains(tolower(first_name),'${term}') or contains(tolower(last_name),'${term}'))`
      : '';

    this.isEmployeeSearchLoading = true;
    this.commonService
      .get(
        `Employees?$filter=is_active eq true${searchFilter}&$select=id,employee_no,first_name,last_name`,
        true,
      )
      .subscribe({
        next: (res: any) => {
          this.employees = (res.value || []).map((item: any) =>
            new Employee().deserialize(item),
          );
          this.isEmployeeSearchLoading = false;
        },
        error: (err: any) => {
          console.error(err);
          this.isEmployeeSearchLoading = false;
        },
      });
  }

  onEmployeeSearchInput(event: any) {
    const value = event?.target?.value ?? '';
    if (this.employeeSearchTimer) clearTimeout(this.employeeSearchTimer);
    this.employeeSearchTimer = setTimeout(() => this.initEmployees(value), 300);
  }

  initMachineGroups() {
    this.commonService
      .get('MachineGroups?$filter=is_active eq true', true)
      .subscribe({
        next: (res: any) => {
          this.machineGroups = res.value ?? [];
        },
        error: (err: any) => console.error(err),
      });
  }

  loadMachinesForGroup(groupId: number) {
    this.filteredMachines = [];
    this.commonService
      .get(`MachineGroups(${groupId})?$expand=machines`, true)
      .subscribe({
        next: (res: any) => {
          this.filteredMachines = (res.machines ?? []).map((m: any) => new Machine().deserialize(m));
        },
        error: (err: any) => console.error(err),
      });
  }

  ensureLookupData() {
    if (!this.employees.length) this.initEmployees();
    if (!this.machineGroups.length) this.initMachineGroups();
    if (!this.shifts.length) this.initShifts();
  }

  initShifts() {
    this.commonService
      .get('EmployeeShifts?$filter=is_active eq true&$select=id,name', true)
      .subscribe({
        next: (res: any) => {
          this.shifts = (res.value ?? []).map((s: any) => new EmployeeShift().deserialize(s));
        },
        error: (err: any) => console.error(err),
      });
  }

  onShiftChange(event: any) {
    const selectedItem = event?.detail?.item;
    if (!selectedItem) {
      this.sideBill.shift_id = null;
      this.shiftName = '';
      return;
    }
    this.sideBill.shift_id = Number(selectedItem.id);
    this.shiftName = selectedItem.text ?? '';
  }

  onMachineGroupChange(event: any) {
    const selectedItem = event?.detail?.item;
    if (!selectedItem) {
      this.sideBill.machine_group_id = null;
      this.machineGroupName = '';
      this.filteredMachines = [];
      this.isRingMachine = false;
      this.isAutoconMachine = false;
      this.sideBill.side = null;
      this.sideBill.current_working_machine_id = null;
      this.sideBill.side_working_machine_id = null;
      this.currentWorkingMachineName = '';
      this.sideWorkingMachineName = '';
      return;
    }
    this.sideBill.machine_group_id = Number(selectedItem.id);
    this.machineGroupName = selectedItem.text ?? '';
    const group = this.machineGroups.find((g: any) => g.id === this.sideBill.machine_group_id);
    this.isRingMachine = !!group?.is_ring;
    this.isAutoconMachine = !!group?.is_autocon;
    if (this.isRingMachine) {
      this.sideBill.amount = 1200;
    } else if (this.isAutoconMachine) {
      this.sideBill.amount = 60;
    }
    this.loadMachinesForGroup(this.sideBill.machine_group_id);
    if (!this.isRingMachine) {
      this.sideBill.side = null;
    }
    this.sideBill.current_working_machine_id = null;
    this.sideBill.side_working_machine_id = null;
    this.currentWorkingMachineName = '';
    this.sideWorkingMachineName = '';
  }

  getEmployeeLabel(employee?: Employee): string {
    if (!employee) return '';
    return `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
  }

  getMachineLabel(machine?: Machine): string {
    return machine?.machine_name || '';
  }

  onEmployeeChange(event: any) {
    const selectedItem = event?.detail?.item;
    if (!selectedItem) {
      this.sideBill.employee_id = null;
      this.employeeName = '';
      return;
    }
    this.sideBill.employee_id = Number(selectedItem.id);
    this.employeeName = selectedItem.text ?? '';
  }


  onCurrentWorkingMachineChange(event: any) {
    const selectedItem = event?.detail?.item;
    if (!selectedItem) {
      this.sideBill.current_working_machine_id = null;
      this.currentWorkingMachineName = '';
      return;
    }
    this.sideBill.current_working_machine_id = Number(selectedItem.id);
    this.currentWorkingMachineName = selectedItem.text ?? '';
  }

  onSideWorkingMachineChange(event: any) {
    const selectedItem = event?.detail?.item;
    if (!selectedItem) {
      this.sideBill.side_working_machine_id = null;
      this.sideWorkingMachineName = '';
      if (this.isRingMachine) this.sideBill.amount = 1200;
      else if (this.isAutoconMachine) this.sideBill.amount = 60;
      return;
    }
    this.sideBill.side_working_machine_id = Number(selectedItem.id);
    this.sideWorkingMachineName = selectedItem.text ?? '';
    if (this.isRingMachine) this.sideBill.amount = 600;
    else if (this.isAutoconMachine) this.sideBill.amount = 40;
  }

  onSideChange(event: any) {
    const value = event?.detail?.selectedOption?.value ?? event?.target?.value ?? null;
    this.sideBill.side = value || null;
  }

  onIsPaidChange(event: any) {
    const checked = event?.detail?.isChecked ?? event?.target?.checked ?? false;
    this.sideBill.status = checked ? 'PAID' : null;
  }

  validateForm(): boolean {
    let isValid = true;

    if (!this.sideBill.employee_id) {
      this.valueStateOptions.employee_id = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.employee_id = ValueState.None;
    }

    if (!this.sideBill.machine_group_id) {
      this.valueStateOptions.machine_group_id = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.machine_group_id = ValueState.None;
    }

    const amount = Number(this.sideBill.amount);
    const hasSideMachine = !!this.sideBill.side_working_machine_id;
    let amountMax: number | null = null;
    if (this.isRingMachine) amountMax = hasSideMachine ? 600 : 1200;
    else if (this.isAutoconMachine) amountMax = hasSideMachine ? 40 : 60;

    if (
      this.sideBill.amount === null ||
      this.sideBill.amount === undefined ||
      amount < 0 ||
      (amountMax !== null && amount > amountMax)
    ) {
      this.valueStateOptions.amount = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.amount = ValueState.None;
    }

    if (this.isRingMachine && !this.sideBill.side) {
      this.valueStateOptions.side = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.side = ValueState.None;
    }

    return isValid;
  }

  newSideBill() {
    this.sideBill = new SideBill().deserialize({ amount: 100, side_bill_date: moment().format('YYYY-MM-DD') });
    this.employeeName = '';
    this.machineGroupName = '';
    this.filteredMachines = [];
    this.currentWorkingMachineName = '';
    this.sideWorkingMachineName = '';
    this.shiftName = '';
    this.isRingMachine = false;
    this.isAutoconMachine = false;
    this.saveMode = saveMode.POST;
    this.ensureLookupData();
    this.open = true;
  }

  editSideBill(data: any) {
    this.sideBill = new SideBill().deserialize(data);
    this.employeeName = this.getEmployeeLabel(this.sideBill.employee);
    this.machineGroupName = data.machineGroup?.name ?? '';
    this.isRingMachine = !!data.machineGroup?.is_ring;
    this.isAutoconMachine = !!data.machineGroup?.is_autocon;
    this.shiftName = data.shift?.name ?? '';
    this.currentWorkingMachineName = this.getMachineLabel(this.sideBill.currentWorkingMachine);
    this.sideWorkingMachineName = this.getMachineLabel(this.sideBill.sideWorkingMachine);
    this.saveMode = saveMode.PUT;
    this.ensureLookupData();
    if (this.sideBill.machine_group_id) {
      this.loadMachinesForGroup(this.sideBill.machine_group_id);
    }
    this.open = true;
  }

  deleteClick(data: any) {
    const id = data?.id;
    if (!id) return;
    this.IsDelete.emit(`SideBills/${id}`);
  }

  saveSideBill() {
    if (!this.validateForm()) return;

    this.loading = true;
    let request$;

    if (this.saveMode === saveMode.POST) {
      this.ToastType = 'add';
      request$ = this.commonService.post(
        'side-bills',
        this.sideBill.toApi(),
        false,
      );
    } else {
      this.ToastType = 'edit';
      request$ = this.commonService.put(
        `side-bills/${this.sideBill.id}`,
        this.sideBill.toApi(),
        false,
      );
    }

    if (request$) {
      request$.subscribe({
        next: () => {
          this.rebuildMainTableFilter();
          this.toastService.show(this.ToastType);
          this.closeDialog();
        },
        error: (err: any) => {
          console.error(err);
          this.toastService.show('error');
          this.closeDialog();
        },
      });
    }
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.sideBill = new SideBill().deserialize({});
    this.employeeName = '';
    this.machineGroupName = '';
    this.valueStateOptions = {
      employee_id: ValueState.None,
      machine_group_id: ValueState.None,
      amount: ValueState.None,
      side: ValueState.None,
    };
    this.filteredMachines = [];
    this.currentWorkingMachineName = '';
    this.sideWorkingMachineName = '';
    this.isRingMachine = false;
  }

  getRowData(row: any): any {
    return row?.original ?? row;
  }

  isRowPaid(row: any): boolean {
    return this.getRowData(row)?.status === 'PAID';
  }

  getRowEmployeeName(row: any): string {
    const data = this.getRowData(row);
    const emp = data?.employee;
    return emp ? `${emp.first_name || ''} ${emp.last_name || ''}`.trim() : '-';
  }

  openMarkPaidDialog() {
    this.markPaidRows = this.payModeSelectedRows.filter(
      (row: any) => !this.isRowPaid(row),
    );
    if (!this.markPaidRows.length) return;

    this.markPaidTotal = this.markPaidRows.reduce(
      (sum: number, row: any) =>
        sum + Number((row.original ?? row).amount ?? 0),
      0,
    );
    this.confirmPayTableData = this.markPaidRows.map(
      (row: any) => row.original ?? row,
    );
    this.isConfirmPayLoading = true;
    this.isMarkPaidDialogOpen = true;
    setTimeout(() => {
      this.isConfirmPayLoading = false;
    }, 200);
  }

  closeMarkPaidDialog() {
    this.isMarkPaidDialogOpen = false;
    this.markPaidRows = [];
    this.markPaidTotal = 0;
    this.confirmPayTableData = [];
    this.isConfirmPayLoading = false;
  }

  confirmMarkPaid() {
    this.isMarkPaidDialogOpen = false;
    this.onPayModeAction();
  }

  openViewDialog(data: any) {
    this.viewSideBill = data;
    this.isViewDialogOpen = true;
  }

  closeViewDialog() {
    this.isViewDialogOpen = false;
    this.viewSideBill = null;
  }

  openMarkPaidFromView() {
    if (!this.viewSideBill) return;
    this.markPaidRows = [this.viewSideBill];
    this.markPaidTotal = Number(this.viewSideBill.amount ?? 0);
    this.confirmPayTableData = [this.viewSideBill];
    this.isConfirmPayLoading = true;
    this.closeViewDialog();
    this.isMarkPaidDialogOpen = true;
    setTimeout(() => {
      this.isConfirmPayLoading = false;
    }, 200);
  }

  onPayModeAction() {
    if (!this.markPaidRows.length) return;

    const ids = this.markPaidRows
      .map((row: any) => (row.original ?? row).id)
      .filter(Boolean);

    let completed = 0;
    ids.forEach((id: number) => {
      this.commonService
        .put(`SideBills(${id})`, { status: 'PAID' }, true)
        .subscribe({
          next: () => {
            completed++;
            if (completed === ids.length) {
              this.toastService.show('edit');
              this.payModeSelectedRows = [];
              this.markPaidRows = [];
              this.markPaidTotal = 0;
              this.rebuildMainTableFilter();
            }
          },
          error: () => this.toastService.show('error'),
        });
    });
  }

  onDeleteSuccess(): void {
    this.refreshTable.emit();
    this.sideBillTableRef?.refreshGridData(true);
    this.toastService.show('delete');
  }

  get confirmPayDataSource(): AgGridTableODataSourceConfig {
    return {
      type: 'odata',
      endpoint: '',
      staticData: true,
      data: this.confirmPayTableData,
    };
  }

  exportSideBills(_event: any) {
    this.IsExportXls.emit();
  }

  getSideBillExportPayload(): any {
    const [from, to] = this.dateRangeValue.split(' - ');
    const params: any = {
      from: moment(from, 'DD/MM/YYYY').format('YYYY-MM-DD'),
      to: moment(to, 'DD/MM/YYYY').format('YYYY-MM-DD'),
    };

    if (this.payMode && this.payModeEmployeeId) {
      params.employee_id = this.payModeEmployeeId;
    }

    return params;
  }

  getSideBillExportFileName(): string {
    const params = this.getSideBillExportPayload();
    return `side-bills-${params.from}-to-${params.to}.xlsx`;
  }
}
