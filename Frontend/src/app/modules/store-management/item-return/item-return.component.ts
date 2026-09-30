import { Component, ViewChild } from "@angular/core";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Permissions } from "@app/shared/enums/permissions";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridActionCellRendererComponent,
  AgGridStatusBadgeComponent,
} from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import {
  AgGridTableColumn,
  AgGridTableRowAction,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { ItemReturnFormComponent } from "@store-module/item-return/item-return-form/item-return-form.component";

@Component({
  selector: "app-item-return",
  templateUrl: "./item-return.component.html",
  styleUrl: "./item-return.component.scss",
})
export class ItemReturnComponent {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @ViewChild("itemReturnForm") formRef!: ItemReturnFormComponent;

  public permissions = Permissions;

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "ItemReturns",
    expand:
      "department,requestBy,purchaseRequisition," +
      "returnItems($expand=product($expand=uom),purchaseRequisitionItem)",
    searchFields: ["custom_id", "purchaseRequisition.custom_id" ,"department.name" ],
    sortBy: "custom_id",
    sortDirection: "desc",
    pageSize: 50,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Items Return`,
    showSearch: true,
    showRowCount: true,
    showDownload: false,
    addButtonText: $localize`New`,
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.STORE_ITEM_RETURN_CREATE,
    ),
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 118px)",
  };

  constructor(
    public rolePermissionService: RolePermissionService,
    private dateFormatter: DateFormatterService,
  ) {
    this.columns = this.buildColumns();
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    const rowActions: AgGridTableRowAction<any>[] = [];

    if (this.rolePermissionService.hasPermission(Permissions.STORE_ITEM_RETURN_VIEW)) {
      rowActions.push({
        id: "view",
        label: "",
        icon: "information",
        tooltip: $localize`View Details`,
        design: "Default",
      });
    }

    const cols: AgGridTableColumn<any>[] = [
      { field: "custom_id", headerName: $localize`Return No`, minWidth: 120, width: 130 },
      {
        colId: "purchaseRequisition.custom_id",
        headerName: $localize`SR No`,
        minWidth: 110,
        sortable: false,
        valueGetter: (p: any) => p.data?.purchaseRequisition?.custom_id ?? "",
      },
      {
        colId: "department.name",
        headerName: $localize`Department`,
        minWidth: 150,
        sortable: false,
        valueGetter: (p: any) => p.data?.department?.name ?? "",
      },
      {
        colId: "items_count",
        headerName: $localize`Items`,
        minWidth: 80,
        width: 80,
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (p: any) => (p.data?.returnItems ?? []).length || "",
      },
      {
        colId: "total_return_quantity",
        headerName: $localize`Return Qty`,
        minWidth: 110,
        width: 120,
        sortable: false,
        filter: false,
        valueGetter: (p: any) =>
          (p.data?.returnItems ?? []).reduce(
            (sum: number, i: any) => sum + (i.return_quantity ?? 0),
            0,
          ),
      },
      {
        field: "return_date",
        headerName: $localize`Return Date`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : "",
      },
      {
        colId: "status",
        headerName: $localize`Status`,
        minWidth: 120,
        width: 130,
        sortable: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (p: any) => p.data?.status ?? "",
      },
    ];

    if (rowActions.length > 0) {
      cols.push({
        field: "actions",
        headerName: $localize`Actions`,
        width: 90,
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
            if (actionId === "view") this.viewItemReturn(row);
          },
        },
      });
    }

    return cols;
  }

  newItemReturn(): void {
    this.formRef.newItemReturn();
  }

  viewItemReturn(data: any): void {
    this.formRef.editItemReturn(data);
  }

  saveEvent(): void {
    this.agGridRef?.refreshGridData(true);
  }
}
