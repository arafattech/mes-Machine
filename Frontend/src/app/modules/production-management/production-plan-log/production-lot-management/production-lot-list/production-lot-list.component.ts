import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import moment from 'moment';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { Localization } from '@app/shared/utilities/localization';
import { ProductionLot } from '@app/shared/model/productionLot';
import { LotStatus } from '@production-module/shared/enums/lot-status';
import { ProductionLotBatchFormComponent } from '@production-module/production-plan-log/production-lot-management/production-lot-batch-form/production-lot-batch-form.component';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridCustomButton,
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  GridTableColumnDataType,
  AgGridTableToolbarConfig,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';

@Component({
  selector: 'app-production-lot-list',
  templateUrl: './production-lot-list.component.html',
})
export class ProductionLotListComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<ProductionLot>;
  @ViewChild('lotFormRef') lotFormRef!: ProductionLotBatchFormComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  public permissions = Permissions;
  gridId = 'production-lot-list';
  columns: AgGridTableColumn<any>[] = this.buildColumns();

  dateRangeValue = '';
  private dateRangeFilter = '';

  dataSource: AgGridTableODataSourceConfig<ProductionLot> = {
    type: 'odata',
    endpoint: 'ProductionLots',
    expand: 'machine,shift,operator,workOrder,counts',
    searchFields: ['custom_id', 'lot_no', 'machine.machine_name', 'shift.name', 'workOrder.custom_id'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Yarn`} ${$localize`Lot`}`,
    showSearch: true,
    showRowCount: true,
    showResetButton: true,
    showSegmentButton: false,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.PRODUCTION_LOT_BATCH_CREATE,
    ),
  };

  customActionButtons: AgGridCustomButton[] = [
    {
      id: 'edit',
      icon: 'edit',
      tooltip: $localize`Edit`,
      design: 'Transparent',
      disable: (row: any) => this.isTransferred(row),
      hide: () => !this.rolePermissionService.hasPermission(this.permissions.PRODUCTION_LOT_EDIT),
      onClick: (row: any) => this.openEdit(row),
    },
    {
      id: 'info',
      icon: 'information',
      tooltip: $localize`Info`,
      design: 'Transparent',
      onClick: (row: any) => this.openView(row),
    },
    {
      id: 'delete',
      icon: 'delete',
      tooltip: $localize`Delete`,
      design: 'Negative',
      disable: (row: any) => this.isTransferred(row),
      hide: () => !this.rolePermissionService.hasPermission(this.permissions.PRODUCTION_LOT_DELETE),
      onClick: (row: any) => this.deleteClick(row),
    },
  ];

  constructor(public rolePermissionService: RolePermissionService) {}

  ngOnInit(): void {
    const today = moment();
    const monthAgo = moment().subtract(1, 'month');
    this.dateRangeValue = `${monthAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateRangeCondition(monthAgo, today);
    this.rebuildFilter();
  }

  resetFilters(): void {
    const today = moment();
    const monthAgo = moment().subtract(1, 'month');
    this.dateRangeValue = `${monthAgo.format('DD/MM/YYYY')} - ${today.format('DD/MM/YYYY')}`;
    this.dateRangeFilter = this.buildDateRangeCondition(monthAgo, today);
    this.rebuildFilter();
    this.agGridRef?.clearSearch();
  }

  onDateRangeStringChange(value: string): void {
    if (!value || !value.includes(' - ')) {
      this.dateRangeValue = '';
      this.dateRangeFilter = '';
      this.rebuildFilter();
      return;
    }

    const [from, to] = value.split(' - ');
    const start = moment(from, 'DD/MM/YYYY');
    const end = moment(to, 'DD/MM/YYYY');
    if (!start.isValid() || !end.isValid()) return;

    this.dateRangeValue = value;
    this.dateRangeFilter = this.buildDateRangeCondition(start, end);
    this.rebuildFilter();
  }

  private buildDateRangeCondition(start: moment.Moment, end: moment.Moment): string {
    return `lot_date ge '${start.format('YYYY-MM-DD')}' and lot_date le '${end.format('YYYY-MM-DD')}'`;
  }

  private rebuildFilter(): void {
    this.dataSource = { ...this.dataSource, filter: this.dateRangeFilter || undefined };
  }

  isTransferred(row: any): boolean {
    const counts: any[] = row?.counts ?? [];
    if (!counts.length) return false;
    const transferredStatuses = [
      LotStatus.PENDING_TRANSFER,
      LotStatus.RECEIVED,
      LotStatus.RECONCILED,
      'PENDING_TRANSFER',
      'RECEIVED',
      'RECONCILED',
    ];
    return counts.some((c) => transferredStatuses.includes(c?.status));
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      { field: 'custom_id', headerName: $localize`Batch No`, minWidth: 130 },
      { field: 'lot_no', headerName: $localize`Lot No`, minWidth: 110 },
      {
        colId: 'machine.machine_name',
        headerName: $localize`Machine`,
        minWidth: 150,
        valueGetter: (p) => p.data?.machine?.machine_name ?? '',
      },
      {
        colId: 'shift.name',
        headerName: $localize`Shift`,
        minWidth: 110,
        valueGetter: (p) => p.data?.shift?.name ?? '',
      },
      {
        field: 'lot_date',
        headerName: $localize`Lot Date`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
      },
      {
        colId: 'counts.length',
        headerName: $localize`Counts`,
        minWidth: 90,
        dataType: GridTableColumnDataType.Number,
        valueGetter: (p) => p.data?.counts?.length ?? 0,
      },
      {
        field: 'created_at',
        headerName: Localization.CreatedAt,
        minWidth: 130,
        filter: false,
      },
    ];
  }

  processData(): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newLot(): void {
    this.lotFormRef.openCreate();
  }

  openEdit(row: any): void {
    if (this.isTransferred(row)) {
      this.openView(row);
      return;
    }
    this.lotFormRef.openManage(new ProductionLot().deserialize(row), false);
  }

  openView(row: any): void {
    this.lotFormRef.openManage(new ProductionLot().deserialize(row), true);
  }

  deleteClick(data: any): void {
    if (typeof data === 'object' && this.isTransferred(data)) {
      return;
    }
    const id = typeof data === 'object' ? data?.id : data;
    this.IsDelete.emit(`ProductionLots/${id}`);
  }
}
