import { Component, ViewChild, inject } from "@angular/core";
import { AuthService } from "@app/services/auth-service/auth.service";
import { CommonService } from "@app/services/common-service/common.service";
import { SocketService } from "@app/services/socket.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridActionCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableRowAction,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { statusStyles } from "@app/shared/utilities/statusStyles";
import { Localization } from "@app/shared/utilities/localization";
import { OrderFormComponent } from "@sales-module/sales-order/order-form/order-form.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Permissions } from "@app/shared/enums/permissions";
import { User } from "@app/shared/model/user";

@Component({
  selector: "app-sales-request",
  templateUrl: "./sales-request.component.html",
  styleUrl: "./sales-request.component.scss",
})
export class SalesRequestComponent {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent;
  @ViewChild("orderFrom") formRef!: OrderFormComponent;

  isShoWaring = false;
  isLoading = false;
  public localization = Localization;
  waringInfo: {
    id: number | string;
    customId: string;
    status: string;
    title: string;
    message: string;
    rejectNote: string;
  } = { id: 0, customId: "", status: "", title: "", message: "", rejectNote: "" };

  private readonly socketService = inject(SocketService);
  private readonly authService = inject(AuthService);
  private authUser: User = new User();

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "SalesOrders",
    expand: "items($expand=product($expand=uom)),client,createdBy",
    filter: "status eq 'PENDING'",
    sortBy: "custom_id",
    sortDirection: "desc",
    searchFields: ["custom_id", "client.name", "createdBy.name"],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Sales Request`,
    showSearch: true,
    showRowCount: true,
    showScanner: true,
    showNewButton: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 100px)",
  };

  constructor(
    public commonService: CommonService,
    private dateFormatter: DateFormatterService,
    public permission: RolePermissionService
  ) {
    this.columns = this.buildColumns();
    this.authUser = this.authService.user();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const rowActions: AgGridTableRowAction<any>[] = [];

    if (this.permission.hasPermission(Permissions.SALES_SALES_REQUEST_VIEW)) {
      rowActions.push({
        id: "view",
        label: "",
        icon: "show",
        design: "Transparent",
        tooltip: $localize`View`,
      });
    }

    rowActions.push({
      id: "download",
      label: "",
      icon: "download",
      design: "Transparent",
      tooltip: $localize`Download Invoice`,
    });

    if (this.permission.hasPermission(Permissions.SALES_SALES_REQUEST_APPROVE)) {
      rowActions.push({
        id: "approve",
        label: $localize`Approve`,
        icon: "accept",
        design: "Emphasized",
        tooltip: $localize`Approve Order`,
      });
    }

    if (this.permission.hasPermission(Permissions.SALES_SALES_REQUEST_REJECT)) {
      rowActions.push({
        id: "reject",
        label: $localize`Reject`,
        icon: "decline",
        design: "Negative",
        tooltip: $localize`Reject Order`,
      });
    }

    const cols: AgGridTableColumn<any>[] = [
      {
        field: "custom_id",
        headerName: $localize`ID`,
        width: 100,
        minWidth: 100,
      },
      {
        colId: "client_name",
        headerName: $localize`Client`,
        minWidth: 140,
        valueGetter: (params: any) => params.data?.client?.name ?? "",
      },
      {
        field: "status",
        headerName: $localize`Status`,
        minWidth: 110,
        filter: false,
        Cell: ({ value }: any) => this.renderStatusCell(value),
      },
      {
        field: "expected_delivery_date",
        headerName: $localize`Delivery Date`,
        minWidth: 150,
        dataType: GridTableColumnDataType.UI5DateRangePicker,
        valueFormatter: (params: any) =>
          this.dateFormatter.formatDate(
            params.value,
            true,
            false,
            false,
            false,
            false
          ),
      },
      {
        field: "discount",
        headerName: $localize`Total Discount`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: "vat",
        headerName: $localize`Total VAT`,
        minWidth: 110,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: "subtotal",
        headerName: $localize`Total`,
        minWidth: 120,
        dataType: GridTableColumnDataType.Number,
      },
      {
        colId: "items_count",
        headerName: $localize`Items`,
        minWidth: 90,
        width: 90,
        filter: false,
        sortable: false,
        valueGetter: (params: any) => {
          const items = params.data?.items ?? [];
          return Array.isArray(items) ? items.length : 0;
        },
        cellRenderer: (params: any) => {
          const count: number = params.value ?? 0;
          if (count === 0) return "";
          return `<span style="display:inline-flex;align-items:center;padding:2px 8px;background:#eff6ff;color:#1d4ed8;border-radius:4px;font-size:12px;font-weight:500">${count}</span>`;
        },
      },
      {
        colId: "created_by_name",
        headerName: $localize`Created By`,
        minWidth: 170,
        valueGetter: (params: any) => params.data?.createdBy?.name ?? "",
      },
    ];

    if (rowActions.length > 0) {
      cols.push({
        field: "actions",
        headerName: $localize`Actions`,
        width: 300,
        minWidth: 260,
        pinned: "right",
        lockPinned: true,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: rowActions,
          onAction: (actionId: string, row: any) => this.onAction(actionId, row),
        },
      });
    }

    return cols;
  }

  private renderStatusCell(value: any): string {
    const s = value || "DRAFT";
    const st = statusStyles[s] || statusStyles["disconnected"] || ({ backgroundColor: "", label: "" } as any);
    const bg = st.backgroundColor || "#e0e0e0";
    const label = st.label || value || "Unknown";
    return `<div style="min-width:90px;height:25px;border-radius:5px;background:${bg};display:flex;justify-content:center;align-items:center;text-transform:uppercase"><span style="color:black;font-weight:500;font-size:.8rem">${label}</span></div>`;
  }

  private onAction(actionId: string, row: any): void {
    switch (actionId) {
      case "view": this.viewOrder(row, true); break;
      case "download": this.downloadPI(row); break;
      case "approve": this.openWarning("APPROVED", row.id, row.custom_id); break;
      case "reject": this.openWarning("REJECTED", row.id, row.custom_id); break;
    }
  }

  openWarning(status: string, id: number | string, customId?: string) {
    this.waringInfo = {
      id,
      customId: customId ?? String(id),
      status,
      title:
        status === "APPROVED"
          ? "Approve sales order"
          : "Reject sales order",
      message:
        status === "APPROVED"
          ? "Are you sure you want to approve this sales order?"
          : "Are you sure you want to reject this sales order?",
      rejectNote: "",
    };
    this.isShoWaring = true;
  }

  confirmWarning() {
    const { status, id, rejectNote } = this.waringInfo;
    this.isShoWaring = false;
    const payload: { status: string; reject_note?: string } = { status };
    if (status === "REJECTED") payload.reject_note = rejectNote;
    this.onChangeAction(payload, id);
  }

  onChangeAction(
    payload: { status: string; reject_note?: string },
    id: number | string
  ) {
    this.commonService.put(`SalesOrders/${id}`, payload).subscribe({
      next: (_res: any) => {
        this.emitActionNotification(payload.status, id);
        this.agGridRef?.refreshGridData(true);
      },
      error: (_err: any) => {},
    });
  }

  private emitActionNotification(status: string, id: number | string): void {
    if (this.waringInfo.id !== id) return;

    const payload = {
      model_id: id,
      model_custom_id: this.waringInfo.customId,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    };

    if (status === "APPROVED") {
      this.socketService.emit("sales-order:approved", payload);
    } else if (status === "REJECTED") {
      this.socketService.emit("sales-order:rejected", payload);
    }
  }

  viewOrder(data: any, isDisabled = false) {
    this.formRef.saveMode = "PUT";
    this.formRef.isDisabled = isDisabled;
    this.formRef.open = true;
    this.formRef.SalesOrder.deserialize(data);

    if (this.formRef.SalesOrder.expected_delivery_date) {
      const formattedDate = this.dateFormatter.formatDate(
        this.formRef.SalesOrder.expected_delivery_date,
        true,
        false,
        false,
        false,
        false
      );
      this.formRef.dateRangeValue = formattedDate;
      this.formRef.SalesOrder.expected_delivery_date = formattedDate;
    }

    this.formRef.getDataFromAssosiate(this.formRef.SalesOrder.items);
    this.formRef.clientName = data.client?.name ?? "";
    this.formRef.populatedItem(this.formRef.SalesOrder.items);
  }

  downloadPI(data: any) {
    if (!data) return;
    this.isLoading = true;
    this.commonService
      .post<Blob>(
        "sales/invoice/generate",
        { order_id: data.id },
        false,
        undefined,
        "blob"
      )
      .subscribe({
        next: (res: Blob) => {
          const filename = `Invoice${data.order_no}.pdf`;
          const blob = new Blob([res], { type: "application/pdf" });
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.isLoading = false;
        },
        error: (_err: unknown) => {
          this.isLoading = false;
        },
      });
  }

  closeWarning() {
    this.isShoWaring = false;
  }
}
