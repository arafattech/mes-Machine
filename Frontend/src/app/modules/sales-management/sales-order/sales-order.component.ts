import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Output,
  ViewChild,
} from "@angular/core";
import { OrderFormComponent } from "@sales-module/sales-order/order-form/order-form.component";
import { SalesStatus } from "@sales-module/shared/enums/sales-status";
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
import { AuthService } from "@app/services/auth-service/auth.service";
import { CommonService } from "@app/services/common-service/common.service";
import { SocketService } from "@app/services/socket.service";
import { SalesOrder } from "@sales-module/shared/model/sales-order";
import { ToastService } from "@app/services/toast-service/toast.service";
import { Localization } from "@app/shared/utilities/localization";
import moment from "moment";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { statusStyles } from "@app/shared/utilities/statusStyles";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Permissions } from "@app/shared/enums/permissions";
import { User } from "@app/shared/model/user";

@Component({
  selector: "app-sales-order",
  templateUrl: "./sales-order.component.html",
  styleUrl: "./sales-order.component.scss",
})
export class SalesOrderComponent {
  @ViewChild("orderFrom") formRef!: OrderFormComponent;
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent;

  @Output() IsDelete: EventEmitter<string> = new EventEmitter<string>();

  isOpenWarning = false;
  SalesOrder: SalesOrder = new SalesOrder().deserialize({});
  public localization = Localization;
  public setStatus: SalesStatus | undefined;
  public permissions = Permissions;
  status = SalesStatus;
  isLoading = false;
  isv8 = false;

  private clientList: { value: string; text: string }[] = [];

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<SalesOrder> =
    this.buildDataSource();

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Sales Order`,
    showSearch: true,
    showRowCount: true,
    showRefreshButton: true,
    refButtonText: $localize`Reset`,
    showNewButton: this.permission.hasPermission(
      Permissions.SALES_SALES_ORDER_CREATE
    ),
    addButtonText: $localize`New`,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 145px)",
  };

  private authUser: User = new User();

  constructor(
    private commonservices: CommonService,
    public toast: ToastService,
    private dateFormatter: DateFormatterService,
    private cdr: ChangeDetectorRef,
    public permission: RolePermissionService,
    private socketService: SocketService,
    private authService: AuthService
  ) {
    this.columns = this.buildColumns();
    this.getClientList();
    this.authUser = this.authService.user();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const canShowActionsColumn =
      this.permission.hasPermission(this.permissions.SALES_SALES_ORDER_CREATE) ||
      this.permission.hasPermission(this.permissions.SALES_SALES_ORDER_EDIT) ||
      this.permission.hasPermission(this.permissions.SALES_SALES_ORDER_DELETE);

    const rowActions: AgGridTableRowAction<any>[] = [];

    if (canShowActionsColumn) {
      rowActions.push(
        {
          id: "edit",
          label: "",
          icon: "edit",
          design: "Transparent",
          tooltip: $localize`Edit`,
          visible: (row: any) =>
            row?.status === SalesStatus.DRAFT &&
            this.permission.hasPermission(
              this.permissions.SALES_SALES_ORDER_EDIT
            ),
        },
        {
          id: "show",
          label: "",
          icon: "show",
          design: "Transparent",
          tooltip: $localize`View`,
          visible: (row: any) =>
            !(
              row?.status === SalesStatus.DRAFT &&
              this.permission.hasPermission(
                this.permissions.SALES_SALES_ORDER_EDIT
              )
            ),
        },
        {
          id: "download",
          label: "",
          icon: "download",
          design: "Transparent",
          tooltip: $localize`Download Invoice`,
        }
      );
    }

    if (
      canShowActionsColumn &&
      this.permission.hasPermission(this.permissions.SALES_SALES_ORDER_DELETE)
    ) {
      rowActions.push({
        id: "delete",
        label: "",
        icon: "delete",
        design: "Transparent",
        tooltip: $localize`Delete`,
        disabled: (row: any) =>
          row?.status === SalesStatus.APPROVED ||
          row?.status === SalesStatus.REJECTED ||
          row?.status === SalesStatus.PENDING,
      });
    }

    if (
      canShowActionsColumn &&
      this.permission.hasPermission(this.permissions.SALES_SALES_ORDER_SEND)
    ) {
      rowActions.push(
        {
          id: "send",
          label: $localize`Send`,
          design: "Emphasized",
          tooltip: $localize`Send Order`,
          visible: (row: any) => row?.status === SalesStatus.DRAFT,
        },
        {
          id: "cancel-order",
          label: $localize`Cancel`,
          design: "Default",
          tooltip: $localize`Cancel Order`,
          visible: (row: any) => row?.status === SalesStatus.PENDING,
        },
        {
          id: "sent",
          label: $localize`Sent`,
          design: "Default",
          tooltip: $localize`Order Sent`,
          visible: (row: any) =>
            row?.status === SalesStatus.APPROVED ||
            row?.status === SalesStatus.REJECTED,
          disabled: () => true,
        }
      );
    }

    const filterControl = this.clientList.length
      ? {
          filterControl: {
            type: "singleSelect" as const,
            options: this.clientList.map((c) => ({ value: c.value, label: c.text })),
            placeholder: $localize`Filter by client...`,
          },
        }
      : {};

    const cols: AgGridTableColumn<any>[] = [
      {
        field: "custom_id",
        headerName: $localize`ID`,
        width: 100,
        minWidth: 100,
      },
      {
        field: this.isv8 ? "clients.name" : "client.name",
        headerName: $localize`Client`,
        minWidth: 170,
        valueGetter: (params: any) =>
          this.isv8
            ? (params.data?.clients?.name ?? "")
            : (params.data?.client?.name ?? ""),
        ...filterControl,
      },
      {
        field: "status",
        headerName: $localize`Status`,
        minWidth: 130,
        filterControl: {
          type: "multiSelect",
          options: [
            { value: "DRAFT",    label: "DRAFT" },
            { value: "PENDING",  label: "PENDING" },
            { value: "APPROVED", label: "APPROVED" },
            { value: "REJECTED", label: "REJECTED" },
          ],
          placeholder: $localize`Filter by status...`,
        },
        Cell: ({ value }: any) => this.renderStatusCell(value),
      },
      {
        field: "subtotal",
        headerName: $localize`Sub Total`,
        minWidth: 120,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: "vat",
        headerName: $localize`Total VAT`,
        minWidth: 100,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: "discount_amount",
        headerName: $localize`Total Discount`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Number,
      },
      {
        field: "grand_total",
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
          const items = this.isv8
            ? (params.data?.sale_order_items ?? [])
            : (params.data?.items ?? []);
          return Array.isArray(items) ? items.length : 0;
        },
        cellRenderer: (params: any) => {
          const count: number = params.value ?? 0;
          if (count === 0) return "";
          return `<span style="display:inline-flex;align-items:center;padding:2px 8px;background:#eff6ff;color:#1d4ed8;border-radius:4px;font-size:12px;font-weight:500">${count}</span>`;
        },
      },
      {
        field: this.isv8 ? "users.name" : "createdBy.name",
        headerName: $localize`Created By`,
        minWidth: 170,
        valueGetter: (params: any) =>
          this.isv8
            ? (params.data?.users?.name ?? "")
            : (params.data?.createdBy?.name ?? ""),
      },
      {
        field: "expected_delivery_date",
        headerName: $localize`Delivary Date`,
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
    ];

    if (canShowActionsColumn) {
      cols.push({
        field: "actions",
        headerName: $localize`Actions`,
        width: 240,
        minWidth: 220,
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

  private buildDataSource(): AgGridTableODataSourceConfig<SalesOrder> {
    return {
      type: "odata",
      endpoint: this.isv8 ? "sales_orders" : "SalesOrders",
      expand: this.isv8
        ? "clients,sale_order_items($expand=products($expand=uoms)),users"
        : "client,createdBy,items($expand=product($expand=uom))",
      sortBy: "custom_id",
      sortDirection: "desc",
      scrollPagination: true,
      searchFields: this.isv8
        ? ["custom_id", "clients.name", "status", "users.name"]
        : ["custom_id", "client.name", "status", "createdBy.name"],
    };
  }

  private onAction(actionId: string, row: any): void {
    switch (actionId) {
      case "edit": this.editOrder(row, false); break;
      case "show": this.editOrder(row, true); break;
      case "download": this.downloadPI(row); break;
      case "delete": this.deletePI(row); break;
      case "send": this.onStatusChange(row, "show", SalesStatus.PENDING); break;
      case "cancel-order": this.onStatusChange(row, "show", SalesStatus.DRAFT); break;
    }
  }

  onStatusChange(data: any, type: "show" | "action", status?: SalesStatus) {
    this.setStatus = status ?? this.setStatus;
    this.SalesOrder.deserialize(data);

    if (type === "show") {
      this.isOpenWarning = true;
      return;
    }

    this.commonservices
      .put(`SalesOrders/${data.id}`, { status: this.setStatus }, true)
      .subscribe({
        next: (_res: any) => {
          if (this.setStatus === SalesStatus.PENDING) {
            this.socketService.emit("sales-order:sent", {
              model_id: data.id,
              model_custom_id: data.custom_id ?? data.id,
              sender_id: this.authUser.id,
              sender_name: this.authUser.name,
            });
          }
          this.agGridRef?.refreshGridData(true);
          this.toast.show("edit");
          this.isOpenWarning = false;
        },
        error: (_err: any) => {},
      });
  }

  downloadPI(data: any) {
    if (!data) return;
    this.isLoading = true;
    this.commonservices
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
          this.cdr.detectChanges();
        },
        error: (_err: unknown) => {
          this.isLoading = false;
        },
      });
  }

  saveEvent() {
    this.agGridRef?.refreshGridData(true);
    this.formRef.open = false;
  }

  editOrder(data: any, isDisabled = false) {
    this.formRef.isDisabled = isDisabled;
    this.formRef.showNewButton = !isDisabled;
    this.formRef.saveMode = "PUT";
    this.formRef.SalesOrder.deserialize(data);

    if (this.formRef.SalesOrder.expected_delivery_date) {
      const formattedDate = moment(
        this.formRef.SalesOrder.expected_delivery_date
      ).format("YYYY-MM-DD");
      this.formRef.dateRangeValue = formattedDate;
      this.formRef.SalesOrder.expected_delivery_date = formattedDate;
    }

    this.formRef.DiscountConfig.Options = data.discount_option ?? "";
    this.formRef.DiscountConfig.Type = data.discount_type ?? "";
    this.formRef.getDataFromAssosiate(
      this.isv8 ? data?.sale_order_items : this.formRef.SalesOrder.items
    );
    this.formRef.clientName = this.isv8
      ? data.clients?.name
      : data.client?.name;
    this.formRef.tableColum();
    this.formRef.open = true;
  }

  deletePI(data: any) {
    this.IsDelete.emit(`SalesOrders/${data.id}`);
  }

  updateTable() {
    this.agGridRef?.refreshGridData(true);
  }

  restoreTable() {
    this.agGridRef?.resetGridState();
  }

  newItem() {
    this.formRef.SalesOrder.status = SalesStatus.DRAFT;
    this.formRef.saveMode = "POST";
    this.formRef.isDisabled = false;
    this.formRef.showNewButton = true;
    this.formRef.isReadOnly = false;
    this.formRef.isStatusReadOnly = true;
    this.formRef.selectedData = null;
    this.formRef.open = true;
  }

  getClientList() {
    this.commonservices.get("/Clients", true).subscribe((res: any) => {
      this.clientList = res.value.map((item: any) => ({
        value: item.name,
        text: item.name,
      }));
      this.columns = this.buildColumns();
    });
  }
}
