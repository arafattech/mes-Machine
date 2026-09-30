import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Localization } from '@shared/utilities/localization';
import {
  AgGridTableCellEditEvent,
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';

interface ExistingApproverRow {
  id: number;
  is_required: boolean;
  sequence_index: number;
}

@Component({
  selector: 'app-approver-assign-form',
  templateUrl: './approver-assign-form.component.html',
  styleUrl: './approver-assign-form.component.scss',
})
export class ApproverAssignFormComponent implements OnChanges {
  @Input() open = false;
  @Output() openChange = new EventEmitter<boolean>();
  @Input() approvalTypeId: number | null = null;
  @Input() excludeEmployeeIds: number[] = [];
  @Input() existingRows: ExistingApproverRow[] = [];
  @Output() saved = new EventEmitter<void>();

  localization = Localization;
  loading = false;
  selectedEmployeeIds: number[] = [];
  private sequenceIndexOverrides = new Map<number, number>();

  columns: AgGridTableColumn<any>[] = [
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
    { field: 'employee_no', headerName: $localize`Employee Id`, minWidth: 130 },
    {
      colId: 'full_name',
      headerName: $localize`Employee Name`,
      flex: 1,
      minWidth: 160,
      valueGetter: (p) => `${p.data?.first_name ?? ''} ${p.data?.last_name ?? ''}`.trim(),
    },
    {
      colId: 'sequence_index',
      headerName: $localize`Order`,
      minWidth: 100,
      sortable: false,
      filter: false,
      editor: { type: 'integer', min: 1 },
    },
  ];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'Employees',
    filter: 'is_active eq true',
    pageSize: 50,
    searchFields: ['employee_no', 'first_name', 'last_name'],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${this.localization.Employee}`,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
    showDownload: false,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {}

  ngOnChanges() {
    if (this.open) {
      const excludeFilter = this.excludeEmployeeIds.map((id) => `id ne ${id}`).join(' and ');
      this.dataSource = {
        ...this.dataSource,
        filter: excludeFilter ? `is_active eq true and ${excludeFilter}` : 'is_active eq true',
      };
    }
  }

  onRowSelect(selectedRows: any[]) {
    this.selectedEmployeeIds = selectedRows.map((row) => row.id);
  }

  onCellEdited(event: AgGridTableCellEditEvent<any>) {
    const employeeId = event.row?.id;
    if (employeeId == null || event.field !== 'sequence_index') return;
    this.sequenceIndexOverrides.set(employeeId, Number(event.newValue));
  }

  save() {
    if (!this.approvalTypeId || !this.selectedEmployeeIds.length) {
      this.closeDialog();
      return;
    }

    this.loading = true;
    const nextIndex = this.existingRows.length
      ? Math.max(...this.existingRows.map((row) => row.sequence_index)) + 1
      : 1;

    const employees = [
      ...this.existingRows.map((row) => ({
        employee_id: row.id,
        is_required: row.is_required,
        sequence_index: row.sequence_index,
      })),
      ...this.selectedEmployeeIds.map((employeeId, offset) => ({
        employee_id: employeeId,
        is_required: true,
        sequence_index: this.sequenceIndexOverrides.get(employeeId) ?? nextIndex + offset,
      })),
    ];

    this.commonService
      .post('approval-type/employee-associate', { approval_type_id: this.approvalTypeId, employees }, false)
      .subscribe({
        next: () => {
          this.toastService.show('add');
          this.saved.emit();
          this.closeDialog();
        },
        error: () => {
          this.toastService.show('error');
          this.loading = false;
        },
      });
  }

  closeDialog() {
    this.open = false;
    this.loading = false;
    this.selectedEmployeeIds = [];
    this.sequenceIndexOverrides.clear();
    this.openChange.emit(false);
  }
}
