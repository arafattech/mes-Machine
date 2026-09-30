import { Component, DestroyRef, OnInit, ViewChild, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { SocketService } from '@app/services/socket.service';
import { AuthService } from '@app/services/auth-service/auth.service';
import { User } from '@app/shared/model/user';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { AgGridTableComponent } from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import { RequisitionFromComponent } from '@store-module/purchase-requisition/requisition-from/requisition-from.component';
import {
  SprStatus,
  SprType,
} from '@store-module/shared/enum/spr-status';
import { Permissions } from '@app/shared/enums/permissions';
import { CommonService } from '@app/services/common-service/common.service';
import {
  AgGridActionCellRendererComponent,
  AgGridStatusBadgeComponent,
} from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableRowAction,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { DateFormatterService } from '@app/shared/utilities/date-format';

@Component({
  selector: 'app-spr-requests',
  templateUrl: './spr-requests.component.html',
  styleUrl: './spr-requests.component.scss',
})
export class SprRequestsComponent implements OnInit {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;
  @ViewChild('requisitionFrom') formRef!: RequisitionFromComponent;

  public permissions = Permissions;
  public selectedData: any;
  public saveMode = 'REQUEST';
  public canApprove = false;
  public canFinalApprove = false;

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'PurchaseRequisitions',
    expand: 'requestBy,department,sprItems($expand=item($expand=category,uom))',
    searchFields: ['custom_id', 'requestBy.name', 'department.name'],
    pageSize: 40,
    sortBy: 'id',
    sortDirection: 'desc',
    filter: this.statusFilter('submitted'),
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Indent Requests`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 118px)',
  };

  segmentButtonItems = [
    { id: 'submitted', name: 'Submitted', defaultSelect: true },
    { id: 'approved', name: 'Approved' },
    { id: 'rejected', name: 'Rejected' },
  ];

  private readonly destroyRef = inject(DestroyRef);
  private readonly socketService = inject(SocketService);
  private readonly authService = inject(AuthService);
  private authUser: User = new User();

  public approvalProgress = new Map<number, { approved: number; rejected: number; total: number }>();

  constructor(public rolePermissionService: RolePermissionService,
    private dateFormatter: DateFormatterService,
    private commonService: CommonService,
  )
    {
    this.authUser = this.authService.user();
  }

  ngOnInit(): void {
    this.socketService
      .on('notification:new')
      .pipe(
        filter((payload: any) => {
          const type = (payload as { type?: string }).type;
          return (
            type === Permissions.STORE_PURCHASE_REQUISITION_CREATE ||
            type === Permissions.STORE_PURCHASE_REQUISITION_APPROVE ||
            type === Permissions.STORE_PURCHASE_REQUISITION_REJECT
          );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => this.agGridRef?.refreshGridData(true));
    this.canApprove = this.rolePermissionService.hasPermission(
      this.permissions.PURCHESE_SPR_APPROVAL,
    );
    this.canFinalApprove = this.rolePermissionService.hasPermission(
      this.permissions.PURCHESE_SPR_FINAL_APPROVAL,
    );

    const rowActions: AgGridTableRowAction<any>[] = [
      {
        id: 'view',
        label: '',
        icon: 'information',
        tooltip: $localize`View`,
        design: 'Transparent',
      },
    ];

    this.columns = this.buildColumns(rowActions);
  }

  private statusFilter(segmentId: string): string {
    let status: string;
    switch (segmentId) {
      case 'approved':
        status = `status eq '${SprStatus.FINAL_APPROVAL}'`;
        break;
      case 'rejected':
        status = `status eq '${SprStatus.REJECTED}'`;
        break;
      default:
        status = `(status eq '${SprStatus.SUBMITTED}' or status eq '${SprStatus.APPROVED}')`;
    }
    return `${status} and type eq '${SprType.SPR}'`;
  }

  private buildColumns(rowActions: AgGridTableRowAction<any>[]): AgGridTableColumn<any>[] {
    return [
      { field: 'id', hide: true },
      {
        field: 'custom_id',
        headerName: $localize`Indent No`,
        minWidth: 100,
        width: 130,
      },
      {
        field: 'requested_by_name',
        headerName: $localize`Requested`,
        minWidth: 150,
        flex: 1,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) => params.data?.requestBy?.name ?? '',
      },
      {
        field: 'department_name',
        headerName: $localize`Department`,
        minWidth: 150,
        flex: 1,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (params: any) => params.data?.department?.name ?? '',
      },
      {
        field: 'request_date',
        headerName: $localize`Request Date`,
        minWidth: 130,
        width: 150,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
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
        field: 'required_by',
        headerName: $localize`Required Date`,
        minWidth: 130,
        width: 150,
        filter: false,
        floatingFilter: false,
        dataType: GridTableColumnDataType.Date,
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
        colId: 'approval_status',
        headerName: $localize`Status`,
        minWidth: 110,
        width: 120,
        filter: false,
        floatingFilter: false,
        sortable: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (params: any) => this.getApprovalStatus(params.data?.id),
      },
      {
        colId: 'approval_progress',
        headerName: $localize`Approval Progress`,
        minWidth: 160,
        width: 170,
        filter: false,
        floatingFilter: false,
        sortable: false,
        cellRenderer: (params: any) => this.renderApprovalProgress(params.data?.id),
      },
      {
        field: 'urgency',
        headerName: $localize`Urgency`,
        minWidth: 120,
        width: 130,
        filter: false,
        floatingFilter: false,
        sortable: false,
        valueFormatter: (params: any) =>
          String(params.value ?? '').toUpperCase() || '-',
      },
      {
        field: 'items_count',
        headerName: $localize`Items`,
        minWidth: 80,
        width: 90,
        filter: false,
        floatingFilter: false,
        sortable: false,
        valueGetter: (params: any) => params.data?.sprItems?.length ?? 0,
      },
      {
        field: 'actions',
        headerName: $localize`Actions`,
        width: 120,
        minWidth: 100,
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        floatingFilter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: rowActions,
          onAction: (actionId: string, row: any) => {
            if (actionId === 'view') this.viewItem(row);
          },
        },
      },
    ];
  }

  segmentButtonChange(event: any): void {
    this.dataSource = {
      ...this.dataSource,
      filter: this.statusFilter(event?.id),
    };
  }

  viewItem(event: any): void {
    this.saveMode = 'REQUEST';
    this.selectedData = event;
    this.formRef.open = true;
    this.formRef.showNewButton = false;
    this.formRef.getSprPopulated(this.selectedData);
    this.formRef.handleReadonly(this.saveMode);
    this.formRef.isReadOnly = true;
  }

  viewItemList(data: any): void {
    this.saveMode = 'PUT';
    this.selectedData = data;
    this.formRef.open = true;
    this.formRef.showNewButton = false;
    this.formRef.getSprPopulated(this.selectedData);
  }

  saveEvent(): void {
    this.emitSprActionNotification();
    this.agGridRef?.refreshGridData(true);
  }

  private emitSprActionNotification(): void {
    const status = this.formRef?.Spr?.status;
    const id = this.selectedData?.id;
    const customId = this.selectedData?.custom_id ?? id;
    if (!id) return;

    const payload = {
      model_id: id,
      model_custom_id: customId,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    };

    if (status === SprStatus.APPROVED || status === SprStatus.FINAL_APPROVAL) {
      this.socketService.emit('store-spr:approved', payload);
    } else if (status === SprStatus.REJECTED) {
      this.socketService.emit('store-spr:rejected', payload);
    }
  }

  // Loaded rows → fetch approval progress for exactly those Indent (SPR) ids in one
  // batched call (avoids an N+1 of per-row lookups), then re-render just the progress
  // column. Bound to both `(processData)` (first page) and `(moreRowsLoaded)`
  // (infinite-scroll batches) — the grid only emits the former for the initial load.
  onGridDataLoaded(data: any): void {
    const rows = Array.isArray(data?.[0]) ? data[0] : data;
    if (!Array.isArray(rows) || rows.length === 0) return;

    const ids = rows.map((row: any) => row.id).filter((id: any) => id != null);
    if (!ids.length) return;

    this.commonService.get(`approval-types/by-code/INDENT/progress?ids=${ids.join(',')}`, false).subscribe({
      next: (res: any) => {
        const total = res?.total ?? {};
        const approved = res?.approved ?? {};
        const rejected = res?.rejected ?? {};
        ids.forEach((id: number) => {
          this.approvalProgress.set(id, {
            approved: Number(approved[id] ?? 0),
            rejected: Number(rejected[id] ?? 0),
            total: Number(total[id] ?? 0),
          });
        });
        this.agGridRef?.getGridApi()?.refreshCells({
          force: true,
          columns: ['approval_status', 'approval_progress'],
        });
      },
      error: () => {},
    });
  }

  private getApprovalStatus(requisitionId?: number): string {
    const progress = this.approvalProgress.get(requisitionId ?? -1);
    if (!progress) return 'PENDING';
    if (progress.rejected > 0) return 'REJECTED';
    if (progress.total > 0 && progress.approved >= progress.total) return 'APPROVED';
    return 'PENDING';
  }

  private renderApprovalProgress(requisitionId?: number): string {
    if (requisitionId == null) return '';
    const progress = this.approvalProgress.get(requisitionId);
    if (!progress || progress.total === 0) return '';

    const percent = Math.round((progress.approved / progress.total) * 100);
    const barColor = progress.approved >= progress.total ? '#10B981' : '#F59E0B';

    return `<div style="display:flex;align-items:center;gap:6px;width:100%">
      <div style="flex:1;height:6px;border-radius:3px;background:#e5e7eb;overflow:hidden">
        <div style="width:${percent}%;height:100%;background:${barColor}"></div>
      </div>
      <span style="font-size:11px;color:#475569;white-space:nowrap">${progress.approved}/${progress.total}</span>
    </div>`;
  }
}
