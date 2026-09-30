import { Component, OnInit, ViewChild } from "@angular/core";
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
import moment from "moment";
import { OrderFormComponent } from "@sales-module/sales-order/order-form/order-form.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";

@Component({
  selector: "app-expired-sales-order",
  templateUrl: "./expired-sales-order.component.html",
  styleUrl: "./expired-sales-order.component.scss",
})
export class ExpiredSalesOrderComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent;
  @ViewChild("orderFrom") formRef!: OrderFormComponent;

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "SalesOrders",
    expand: "items($expand=product($expand=uom)),client,createdBy",
    filter: "",
    sortBy: "id",
    sortDirection: "desc",
    searchFields: ["custom_id", "client.name", "createdBy.name"],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Expired Sales Order`,
    showSearch: true,
    showRowCount: true,
    showNewButton: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 145px)",
  };

  columns: AgGridTableColumn<any>[] = [];

  constructor(private dateFormatter: DateFormatterService) {
    this.columns = this.buildColumns();
  }

  ngOnInit(): void {
    const today = moment().format("YYYY-MM-DD HH:mm:ss");
    this.dataSource = {
      ...this.dataSource,
      baseFilter: `expected_delivery_date lt '${today}' and status eq 'APPROVED'`,
    };
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const rowActions: AgGridTableRowAction<any>[] = [
      {
        id: "view",
        label: "",
        icon: "show",
        design: "Transparent",
        tooltip: $localize`View`,
      },
    ];

    return [
      {
        field: "custom_id",
        headerName: $localize`ID`,
        width: 100,
        minWidth: 100,
      },
      {
        colId: "client_name",
        headerName: $localize`Client`,
        minWidth: 150,
        valueGetter: (params: any) => params.data?.client?.name ?? "",
      },
      {
        field: "expected_delivery_date",
        headerName: $localize`Delivery Date`,
        minWidth: 150,
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
        field: "grand_total",
        headerName: $localize`Total`,
        minWidth: 120,
        dataType: GridTableColumnDataType.Number,
      },
      {
        colId: "created_by_name",
        headerName: $localize`Created By`,
        minWidth: 170,
        valueGetter: (params: any) => params.data?.createdBy?.name ?? "",
      },
      {
        field: "status",
        headerName: $localize`Status`,
        minWidth: 100,
        filter: false,
        Cell: ({ value }: any) => this.renderStatusCell(value),
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
        field: "actions",
        headerName: $localize`Actions`,
        width: 80,
        minWidth: 80,
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
      },
    ];
  }

  private renderStatusCell(value: any): string {
    const s = value || "DRAFT";
    const st = statusStyles[s] || statusStyles["disconnected"] || ({ backgroundColor: "", label: "" } as any);
    const bg = st.backgroundColor || "#e0e0e0";
    const label = st.label || value || "Unknown";
    return `<div style="min-width:90px;height:25px;border-radius:5px;background:${bg};display:flex;justify-content:center;align-items:center;text-transform:uppercase"><span style="color:black;font-weight:500;font-size:.8rem">${label}</span></div>`;
  }

  private onAction(actionId: string, row: any): void {
    if (actionId === "view") this.viewOrder(row, true);
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
}
