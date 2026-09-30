import { Component, DestroyRef, OnInit, ViewChild, inject } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { SocketService } from "@app/services/socket.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridActionCellRendererComponent,
  AgGridApprovalProgressCellRendererComponent,
  AgGridStatusBadgeComponent,
} from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import {
  AgGridTableColumn,
  AgGridTableRowAction,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { RequisitionFromComponent } from "@store-module/purchase-requisition/requisition-from/requisition-from.component";
import {
  SprStatus,
  SprType,
} from "@store-module/shared/enum/spr-status";
import { Permissions } from "@app/shared/enums/permissions";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { GridTableColumnDataType } from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { CommonService } from "@app/services/common-service/common.service";

@Component({
  selector: "app-purchase-requisition",
  templateUrl: "./purchase-requisition.component.html",
  styleUrl: "./purchase-requisition.component.scss",
})
export class PurchaseRequisitionComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @ViewChild("requisitionFrom") formRef!: RequisitionFromComponent;

  public saveMode = "POST";
  public selectedData: any;
  public permissions = Permissions;

  segmentButtonItems = [
    { id: "submitted", name: "Submitted", defaultSelect: true },
    { id: "approved", name: "Approved" },
    { id: "rejected", name: "Rejected" },
  ];

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "PurchaseRequisitions",
    expand: "requestBy,department,sprItems($expand=item($expand=category,uom))",
    searchFields: ["custom_id", "requestBy.name", "department.name", "urgency"],
    sortBy: "id",
    sortDirection: "desc",
    filter: this.statusFilter("submitted"),
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Indent Requisition`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    addButtonText: $localize`New`,
    showDownload: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 118px)",
  };

  private readonly destroyRef = inject(DestroyRef);
  private readonly socketService = inject(SocketService);

  private readonly SPR_NOTIFICATION_TYPES = new Set([
    Permissions.STORE_PURCHASE_REQUISITION_CREATE,
    Permissions.STORE_PURCHASE_REQUISITION_APPROVE,
    Permissions.STORE_PURCHASE_REQUISITION_REJECT,
  ]);

  public approvalProgress = new Map<number, { approved: number; rejected: number; total: number }>();

  constructor(
    public rolePermissionService: RolePermissionService,
    private dateFormatter: DateFormatterService,
    private commonService: CommonService,
  ) {}

  ngOnInit(): void {
    this.socketService
      .on('notification:new')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((payload: unknown) => {
        const p = payload as { type?: string };
        if (p.type && this.SPR_NOTIFICATION_TYPES.has(p.type as Permissions)) {
          this.agGridRef?.refreshGridData(true);
        }
      });
    const canView = this.rolePermissionService.hasPermission(
      this.permissions.STORE_PURCHASE_REQUISITION_VIEW
    );
    const rowActions: AgGridTableRowAction<any>[] = canView
      ? [
          {
            id: "view",
            label: "",
            icon: "information",
            tooltip: $localize`View Details`,
            design: "Default",
          },
        ]
      : [];

    this.toolbarConfig = {
      ...this.toolbarConfig,
      showNewButton: this.rolePermissionService.hasPermission(
        this.permissions.STORE_PURCHASE_REQUISITION_CREATE
      ),
    };
    this.columns = this.buildColumns(rowActions);
  }

  private buildColumns(
    rowActions: AgGridTableRowAction<any>[]
  ): AgGridTableColumn<any>[] {
    const cols: AgGridTableColumn<any>[] = [
      { field: "id", hide: true },
      { field: "custom_id", headerName: $localize`Indent No`, minWidth: 100, width: 120 },
      {
        colId: "requestBy.name",
        headerName: $localize`Requested`,
        flex: 1,
        minWidth: 140,
        sortable: false,
        valueGetter: (p: any) => p.data?.requestBy?.name ?? "",
      },
      {
        colId: "department.name",
        headerName: $localize`Department`,
        flex: 1,
        minWidth: 140,
        sortable: false,
        valueGetter: (p: any) => p.data?.department?.name ?? "",
      },
      {
        field: "request_date",
        headerName: $localize`Request Date`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : "",
      },
      {
        field: "required_by",
        headerName: $localize`Required Date`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : "",
      },
      {
        colId: "approval_status",
        headerName: $localize`Status`,
        minWidth: 110,
        width: 120,
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (p: any) => this.getApprovalStatus(p.data?.id),
      },
      {
        colId: "approval_progress",
        headerName: $localize`Approval Progress`,
        minWidth: 160,
        width: 170,
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: AgGridApprovalProgressCellRendererComponent,
        valueGetter: (p: any) => this.approvalProgress.get(p.data?.id) ?? null,
      },
      {
        field: "urgency",
        headerName: $localize`Urgency`,
        minWidth: 110,
        width: 120,
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: AgGridStatusBadgeComponent,
      },
      {
        colId: "items_count",
        headerName: $localize`Items`,
        minWidth: 80,
        width: 80,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (p: any) => (p.data?.sprItems ?? []).length || "",
      },
      {
        colId: "is_complete",
        headerName: $localize`Complete`,
        minWidth: 100,
        width: 110,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (p: any) => (p.data?.is_complete ? 'COMPLETED' : 'PENDING'),
        cellRenderer: AgGridStatusBadgeComponent,
      },
    ];

    if (rowActions.length > 0) {
      cols.push({
        field: "actions",
        headerName: $localize`Actions`,
        width: 100,
        minWidth: 80,
        pinned: "right",
        lockPinned: true,
        sortable: false,
        filter: false,
        floatingFilter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: rowActions,
          onAction: (actionId: string, row: any) => {
            if (actionId === "view") this.viewItem(row);
          },
        },
      });
    }

    return cols;
  }

  segmentButtonChange(event: any): void {
    this.dataSource = {
      ...this.dataSource,
      filter: this.statusFilter(event?.id ?? event?.value),
    };
  }

  private statusFilter(segmentId: string): string {
    let status: string;
    switch (segmentId) {
      case "approved":
        status = `status eq '${SprStatus.FINAL_APPROVAL}'`;
        break;
      case "rejected":
        status = `status eq '${SprStatus.REJECTED}'`;
        break;
      default:
        status = `(status eq '${SprStatus.SUBMITTED}' or status eq '${SprStatus.APPROVED}')`;
    }
    return `type eq '${SprType.SPR}' and ${status}`;
  }

  newItem(): void {
    this.formRef.open = true;
    this.saveMode = "POST";
    this.formRef.showNewButton = true;
    this.formRef.getCustomId();
    this.formRef.reset();
    this.formRef.autoSelectDepartmentFromEmployee();
  }

  viewItem(event: any): void {
    this.saveMode = "PUT";
    this.selectedData = event;
    this.formRef.open = true;
    // Locked once fully approved/rejected, or once any approver in the per-person chain
    // has already acted (e.g. 2/3 approved) — prevents editing/resubmitting mid-chain.
    const progress = this.approvalProgress.get(event.id);
    const hasApprovalActivity = !!progress && (progress.approved > 0 || progress.rejected > 0);
    const isReadOnly =
      event.status === SprStatus.APPROVED ||
      event.status === SprStatus.FINAL_APPROVAL ||
      event.status === SprStatus.REJECTED ||
      hasApprovalActivity;
    this.formRef.showNewButton = !isReadOnly;
    this.formRef.isStatusReadOnly = isReadOnly;
    this.formRef.isReadOnly = isReadOnly;
    this.formRef.getSprPopulated(this.selectedData);
  }

  saveEvent(): void {
    this.agGridRef?.refreshGridData(true);
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
}
