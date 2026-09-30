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
import { CommonService } from "@app/services/common-service/common.service";
import {
  AgGridTableColumn,
  AgGridTableRowAction,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { RequisitionFromComponent } from "@store-module/purchase-requisition/requisition-from/requisition-from.component";
import {
  SprStatus,
  SprType,
} from "@store-module/shared/enum/spr-status";
import { Permissions } from "@app/shared/enums/permissions";
import { Localization } from "@app/shared/utilities/localization";

@Component({
  selector: "app-store-requisition",
  templateUrl: "./store-requisition.component.html",
  styleUrl: "./store-requisition.component.scss",
})
export class StoreRequisitionComponent implements OnInit {
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
    searchFields: ["custom_id", "requestBy.name", "department.name"],
    sortBy: "id",
    sortDirection: "desc",
    filter: this.statusFilter("submitted"),
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`SR Requisition List`,
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

  private readonly SR_NOTIFICATION_TYPES = new Set([
    Permissions.STORE_STORE_REQUISITION_CREATE,
    Permissions.STORE_STORE_REQUISITION_APPROVE,
    Permissions.STORE_STORE_REQUISITION_REJECT,
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
        if (p.type && this.SR_NOTIFICATION_TYPES.has(p.type as Permissions)) {
          this.agGridRef?.refreshGridData(true);
        }
      });

    const departmentId = localStorage.getItem("department_id");
    if (
      departmentId &&
      !this.rolePermissionService.hasPermission(this.permissions.STORE_ADMIN)
    ) {
      this.dataSource = {
        ...this.dataSource,
        filter: `${this.dataSource.filter} and department_id eq '${departmentId}'`,
      };
    }

    const canView = this.rolePermissionService.hasPermission(
      this.permissions.STORE_STORE_REQUISITION_VIEW
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
        this.permissions.STORE_STORE_REQUISITION_CREATE
      ),
    };
    this.columns = this.buildColumns(rowActions);
  }

  private buildColumns(
    rowActions: AgGridTableRowAction<any>[]
  ): AgGridTableColumn<any>[] {
    const cols: AgGridTableColumn<any>[] = [
      { field: "id", hide: true },
      { field: "custom_id", headerName: $localize`SR No`, minWidth: 100, width: 120 },
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
        colId: "items_count",
        headerName: $localize`Items`,
        minWidth: 80,
        width: 80,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (p: any) => (p.data?.sprItems ?? []).length || "",
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
    let filter = this.statusFilter(event?.id ?? event?.value);
    const departmentId = localStorage.getItem("department_id");
    if (
      departmentId &&
      !this.rolePermissionService.hasPermission(this.permissions.STORE_ADMIN)
    ) {
      filter += ` and department_id eq '${departmentId}'`;
    }
    this.dataSource = { ...this.dataSource, filter };
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
    return `type eq '${SprType.SR}' and ${status}`;
  }

  newItem(): void {
    this.formRef.open = true;
    this.saveMode = "POST";
    this.formRef.showNewButton = true;
    this.formRef.getSrCustomId();
    this.formRef.reset();
    this.formRef.autoSelectDepartmentFromEmployee();
    this.formRef.isStatusReadOnly = true;
    this.formRef.stockTitle = Localization.currentStock;
    this.formRef.variableValueChange();
  }

  viewItem(event: any): void {
    this.saveMode = "PUT";
    this.selectedData = event;
    this.formRef.open = true;
    // GM approved (APPROVED / FINAL_APPROVAL) or rejected → locked. Any approver having
    // already acted on the per-person approval chain (even mid-chain, e.g. 2/3) → locked
    // too, so a partially-approved SR can't still be edited/resubmitted from this dialog.
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
    this.formRef.stockTitle = isReadOnly
      ? Localization.previousStock
      : Localization.currentStock;
    this.formRef.getSprPopulated(this.selectedData);
    this.formRef.variableValueChange();
  }

  saveEvent(): void {
    this.agGridRef?.refreshGridData(true);
  }

  // Loaded rows → fetch approval progress for exactly those SR ids in one batched call
  // (avoids an N+1 of per-row lookups), then re-render just the progress column.
  onGridDataLoaded(data: any): void {
    const rows = Array.isArray(data?.[0]) ? data[0] : data;
    if (!Array.isArray(rows) || rows.length === 0) return;

    const ids = rows.map((row: any) => row.id).filter((id: any) => id != null);
    if (!ids.length) return;

    this.commonService.get(`approval-types/by-code/SR/progress?ids=${ids.join(',')}`, false).subscribe({
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
