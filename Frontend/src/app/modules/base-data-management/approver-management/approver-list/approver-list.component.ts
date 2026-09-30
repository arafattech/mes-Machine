import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { Localization } from '@shared/utilities/localization';
import { saveMode } from '@shared/enums/saveMode';
import { ApprovalType } from '@shared/model/approvalType';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableCellEditEvent,
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

interface ApproverRow {
  id: number;
  employee_no: number;
  first_name: string;
  last_name: string;
  is_required: boolean;
  sequence_index: number;
}

@Component({
  selector: 'app-approver-list',
  templateUrl: './approver-list.component.html',
  styleUrl: './approver-list.component.scss',
})
export class ApproverListComponent implements OnInit {
  @Output() IsDelete = new EventEmitter<any>();
  @ViewChild('typeTableRef') typeTableRef?: AgGridTableComponent<any>;

  public localization = Localization;
  public permissionEnum = Permissions;

  selectedApprovalTypeId: number | null = null;
  selectedApprovalTypeName = '';
  approverRows: ApproverRow[] = [];
  assignedEmployeeIds: number[] = [];

  approvalType = new ApprovalType().deserialize({});
  saveMode: string = saveMode.POST;
  open = false;
  isAssignOpen = false;

  private readonly seededApprovalTypeCodes = ['SR', 'INDENT'];
  isSeededApprovalType = (row: any): boolean =>
    this.seededApprovalTypeCodes.includes(row?.code);

  typeColumns: AgGridTableColumn<any>[] = [
    {
      field: 'is_active',
      headerName: $localize`Active`,
      cellRenderer: AgGridBooleanCellRendererComponent,
      filter: false,
      sortable: false,
      floatingFilter: false,
      width: 90,
      minWidth: 80,
    },
    { field: 'code', headerName: $localize`Code`, minWidth: 140 },
    { field: 'name', headerName: $localize`Approval Type`, minWidth: 200, flex: 1 },
  ];

  typeDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: 'ApprovalTypes',
    pageSize: 50,
    sortBy: 'name',
    searchFields: ['name'],
  };

  typeToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Approval Types`,
    showSearch: true,
    showRowCount: true,
    addButtonText: $localize`New`,
    showNewButton: false,
  };

  ngOnInit(): void {
    this.typeToolbarConfig = {
      ...this.typeToolbarConfig,
      showNewButton: this.rolePermissionService.hasPermission(
        this.permissionEnum.BASE_DATA_APPROVER_CREATE,
      ),
    };
  }

  typeDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 120px)',
  };

  approverColumns: AgGridTableColumn<any>[] = [
    {
      field: 'employee_no',
      headerName: $localize`Employee ID`,
      minWidth: 120,
      sortable: false,
      filter: false,
    },
    {
      colId: 'full_name',
      headerName: $localize`Employee Name`,
      flex: 1,
      minWidth: 160,
      sortable: false,
      filter: false,
      valueGetter: (p) => `${p.data?.first_name ?? ''} ${p.data?.last_name ?? ''}`.trim(),
    },
    {
      field: 'is_required',
      headerName: $localize`Required`,
      minWidth: 110,
      sortable: false,
      filter: false,
      valueFormatter: (params: any) => (params.value ? $localize`True` : $localize`False`),
      editor: {
        type: 'select',
        options: [
          { id: 'true', label: $localize`True` },
          { id: 'false', label: $localize`False` },
        ],
      },
    },
    {
      field: 'sequence_index',
      headerName: $localize`Order`,
      minWidth: 100,
      sortable: false,
      filter: false,
      editor: { type: 'integer', min: 1 },
    },
  ];

  approverDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  approverToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Approvers`,
    showSearch: false,
    showRowCount: true,
    showNewButton: false,
    addButtonText: $localize`Assign`,
  };

  approverDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 120px)',
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    public rolePermissionService: RolePermissionService,
  ) {}

  processData(data: any) {
    if (this.selectedApprovalTypeId !== null) return;
    const rows = Array.isArray(data?.[0]) ? data[0] : data;
    if (!Array.isArray(rows) || rows.length === 0) return;
    this.applyTypeSelection(rows[0]);
  }

  selectedRowData(row: any) {
    if (!row?.id) return;
    this.applyTypeSelection(row);
  }

  private applyTypeSelection(row: any) {
    this.selectedApprovalTypeId = row.id;
    this.selectedApprovalTypeName = row.name ?? '';
    this.approverToolbarConfig = {
      ...this.approverToolbarConfig,
      showNewButton: this.rolePermissionService.hasPermission(
        this.permissionEnum.BASE_DATA_APPROVER_ASSIGN,
      ),
    };
    this.loadApprovers();

    const targetId = String(row.id);
    setTimeout(() => {
      const api = this.typeTableRef?.getGridApi();
      if (!api) return;
      api.forEachNode((node: any) => {
        if (String(node.data?.id ?? '') === targetId) node.setSelected(true, false, 'api');
      });
    }, 0);
  }

  loadApprovers() {
    if (!this.selectedApprovalTypeId) return;
    this.commonService
      .get(`approval-types/${this.selectedApprovalTypeId}/approvers`, false)
      .subscribe({
        next: (res: any) => {
          const rows = (res?.data ?? []) as any[];
          this.approverRows = rows.map((row) => ({
            id: row.id,
            employee_no: row.employee_no,
            first_name: row.first_name,
            last_name: row.last_name,
            is_required: !!row.pivot?.is_required,
            sequence_index: Number(row.pivot?.sequence_index ?? 1),
          }));
          this.assignedEmployeeIds = this.approverRows.map((row) => row.id);
          this.approverDataSource = { ...this.approverDataSource, data: this.approverRows };
        },
        error: () => {
          this.approverRows = [];
          this.assignedEmployeeIds = [];
          this.approverDataSource = { ...this.approverDataSource, data: [] };
        },
      });
  }

  onApproverCellEdited(event: AgGridTableCellEditEvent<ApproverRow>) {
    const row = event.row;
    if (!row?.id || !this.selectedApprovalTypeId) return;

    const newValue =
      event.field === 'is_required' ? event.newValue === 'true' || event.newValue === true : event.newValue;

    const updatedRows = this.approverRows.map((r) =>
      r.id === row.id ? { ...r, [event.field]: newValue } : r,
    );
    this.saveApprovers(updatedRows);
  }

  removeApprover(data: any) {
    if (!data?.id) return;
    const updatedRows = this.approverRows.filter((row) => row.id !== data.id);
    this.saveApprovers(updatedRows);
  }

  private saveApprovers(rows: ApproverRow[]) {
    if (!this.selectedApprovalTypeId) return;
    const payload = {
      approval_type_id: this.selectedApprovalTypeId,
      employees: rows.map((row) => ({
        employee_id: row.id,
        is_required: row.is_required,
        sequence_index: row.sequence_index,
      })),
    };

    this.commonService.post('approval-type/employee-associate', payload, false).subscribe({
      next: () => {
        this.toastService.show('edit');
        this.loadApprovers();
      },
      error: () => {
        this.toastService.show('error');
        this.loadApprovers();
      },
    });
  }

  newApprovalType() {
    this.approvalType = new ApprovalType().deserialize({});
    this.saveMode = saveMode.POST;
    this.open = true;
  }

  editApprovalType(data: any) {
    this.approvalType = new ApprovalType().deserialize(data);
    this.saveMode = saveMode.PUT;
    this.open = true;
  }

  deleteApprovalType(data: any) {
    this.IsDelete.emit(`ApprovalTypes/${data.id}`);
  }

  openAssignDialog() {
    if (!this.selectedApprovalTypeId) return;
    this.isAssignOpen = true;
  }

  onAssignSaved() {
    this.isAssignOpen = false;
    this.loadApprovers();
  }

  refreshTypeTable() {
    this.typeTableRef?.refreshGridData(true);
  }
}
