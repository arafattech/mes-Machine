import { Component, EventEmitter, OnInit, Output, ViewChild } from '@angular/core';
import moment from 'moment';
import { WorkOrderFormComponent } from '@production-module/production-plan-log/work-order-management/work-order-form/work-order-form.component';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Permissions } from '@app/shared/enums/permissions';
import { saveMode } from '@app/shared/enums/saveMode';
import { WorkOrder } from '@app/shared/model/work-order';
import { Localization } from '@app/shared/utilities/localization';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridStatusBadgeComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';

@Component({
  selector: 'app-work-order-list',
  templateUrl: './work-order-list.component.html',
  styleUrl: './work-order-list.component.scss',
})
export class WorkOrderListComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<WorkOrder>;
  @ViewChild('workOrderForm') workOrderFormRef!: WorkOrderFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  public permissions = Permissions;
  public saveMode: string = saveMode.POST;
  workOrder = new WorkOrder().deserialize({});

  /** Full cross-machine work order dashboard (OEE, overall progress, per-machine/shift
   * breakdown, wastage by type across every machine) — moved here from the per-machine
   * `/mco` Work Order tab, which now shows only that one machine's own contribution
   * (`MachineWorkOrderOverviewComponent`). This is the "how's the whole WO doing" view. */
  detailOpen = false;
  detailWorkOrderId: number | null = null;
  detailSubtitle = '';

  gridId = 'production-work-order-list';
  columns: AgGridTableColumn<any>[] = [];

  dateRangeValue = '';
  private dateRangeFilter = '';

  dataSource: AgGridTableODataSourceConfig<WorkOrder> = {
    type: 'odata',
    endpoint: 'WorkOrders',
    expand: 'product,machines',
    // 'machines.machine_name' deliberately excluded: combining a to-many nav any() with
    // the existing to-one 'product.product_name' any() in one OR filter breaks Lodata's
    // SQL generation (confirmed — produces a dangling "OR )" and a MySQL syntax error).
    // Use the Machines column's own floating filter to search by machine instead.
    searchFields: ['custom_id', 'product.product_name'],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Production Order`} ${$localize`List`}`,
    showSearch: true,
    showRowCount: true,
    showResetButton: true,
    showSegmentButton: true,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_WORK_ORDER_CREATE,
    ),
  };

  constructor(public rolePermissionService: RolePermissionService) {
    this.columns = this.buildColumns();
  }

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
    return `scheduled_start ge '${start.format('YYYY-MM-DD')}' and scheduled_start le '${end.format('YYYY-MM-DD')}'`;
  }

  private rebuildFilter(): void {
    this.dataSource = { ...this.dataSource, filter: this.dateRangeFilter || undefined };
  }

  private buildColumns(): AgGridTableColumn<any>[] {
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
        headerName: $localize`WO Number`,
        minWidth: 130,
      },
      {
        colId: 'product.product_name',
        headerName: $localize`Product`,
        minWidth: 200,
        valueGetter: (p) => p.data?.product?.product_name ?? '',
      },
      {
        colId: 'machines.machine_name',
        headerName: $localize`Machines`,
        minWidth: 200,
        valueGetter: (p) =>
          p.data?.machines?.map((m: any) => m.machine_name).join(', ') ?? '',
      },
      {
        field: 'quantity',
        headerName: $localize`Quantity`,
        minWidth: 110,
        dataType: GridTableColumnDataType.Number,
        valueFormatter: ({ value }: any) =>
          value != null ? Number(value).toLocaleString() : '',
      },
      {
        field: 'status',
        headerName: $localize`Status`,
        minWidth: 140,
        cellRenderer: AgGridStatusBadgeComponent,
      },
      {
        field: 'scheduled_start',
        headerName: $localize`Scheduled Start`,
        minWidth: 150,
        dataType: GridTableColumnDataType.Date,
      },
      {
        field: 'created_at',
        headerName: Localization.CreatedAt,
        minWidth: 130,
        filter: false,
        floatingFilter: false,
      },
    ];
  }

  processData(_event?: any): void {
    this.refreshTable.emit();
    this.agGridRef?.refreshGridData(true);
  }

  newWorkOrder(): void {
    this.workOrder = new WorkOrder().deserialize({});
    this.workOrderFormRef.open = true;
    this.saveMode = saveMode.POST;
  }

  editWorkOrder(data: any): void {
    this.workOrder = new WorkOrder().deserialize(data);
    this.workOrderFormRef.open = true;
    this.saveMode = saveMode.PUT;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`WorkOrders/${id}`);
  }

  viewDetail(row: any): void {
    this.detailWorkOrderId = row.id;
    this.detailSubtitle = row.custom_id || `WO-${row.id}`;
    this.detailOpen = true;
  }

  closeDetail(): void {
    this.detailOpen = false;
    this.detailWorkOrderId = null;
  }
}
