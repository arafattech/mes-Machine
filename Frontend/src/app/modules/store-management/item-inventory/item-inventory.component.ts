import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
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
import { Product } from "@shared/model/product";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import { ItemDetailsComponent } from "@app/modules/store-management/item-inventory/item-details/item-details.component";
import { Permissions } from "@app/shared/enums/permissions";

@Component({
  selector: "app-item-inventory",
  templateUrl: "./item-inventory.component.html",
  styleUrl: "./item-inventory.component.scss",
})
export class ItemInventoryComponent implements OnInit {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent<any>;
  @ViewChild("itemForm") itemFormRef!: ItemDetailsComponent;

  product = new Product();
  clone = false;
  columns: AgGridTableColumn<any>[] = [];
  public saveMode: string = saveMode.POST;
  public permissions = Permissions;
  public localization = Localization;

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "Products",
    expand: "suppliers,productTypes,category,clients,plants,variants,uom",
    searchFields: [
      "item_code",
      "product_name",
      "model_number",
      "category.name",
      "unit_price",
      "current_stock",
      "minimum_stock",
    ],
    sortBy: "id",
    sortDirection: "desc",
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Item`} ${$localize`List`}`,
    showRowCount: true,
    showSearch: true,
    showNewButton: false,
    showDownload: true,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 118px)",
  };

  constructor(
    private commonService: CommonService,
    public rolePermissionService: RolePermissionService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService,
  ) {}

  ngOnInit(): void {
    const canView = this.rolePermissionService.hasPermission(
      this.permissions.STORE_ITEM_INVENTORY_VIEW
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

    this.columns = this.buildColumns(rowActions);
  }

  private buildColumns(
    rowActions: AgGridTableRowAction<any>[]
  ): AgGridTableColumn<any>[] {
    const cols: AgGridTableColumn<any>[] = [
      { field: "item_code", headerName: `${$localize`Item`} ${$localize`Code`}`, minWidth: 120 },
      { field: "product_name", headerName: `${$localize`Item`} ${$localize`Name`}`, flex: 1, minWidth: 150 },
      {
        colId: "category.name",
        headerName: $localize`Category`,
        minWidth: 140,
        sortable: false,
        valueGetter: (p: any) => p.data?.category?.name ?? "",
      },
      { field: "model_number", headerName: $localize`Model`, minWidth: 120 },
      { field: "rack_no", headerName: `${$localize`Rack`} ${$localize`Number`}`, minWidth: 120 },
      { field: "current_stock", headerName: `${$localize`Current`} ${$localize`Stock`}`, minWidth: 120, width: 130 },
      { field: "minimum_stock", headerName: `${$localize`Minimum`} ${$localize`Stock`}`, minWidth: 120, width: 130 },
      {
        colId: "stock_status",
        headerName: $localize`Status`,
        minWidth: 110,
        width: 120,
        sortable: false,
        filter: false,
        floatingFilter: false,
        cellRenderer: AgGridStatusBadgeComponent,
        valueGetter: (p: any) => {
          const current = p.data?.current_stock ?? 0;
          const minimum = p.data?.minimum_stock ?? 0;
          return current < minimum ? "Critical" : "Normal";
        },
      },
      { field: "unit_price", headerName: `${$localize`Unit`} ${$localize`Price`}`, minWidth: 110, width: 120 },
      {
        field: "created_at",
        headerName: $localize`Created On`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : "",
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
            if (actionId === "view") this.ItemDetails(row);
          },
        },
      });
    }

    return cols;
  }

  ItemDetails(data: any): void {
    this.product = data;
    this.saveMode = saveMode.PUT;
    this.itemFormRef.isclone = false;
    this.itemFormRef.open = true;
    this.itemFormRef.product = structuredClone(
      new Product().deserialize(data)
    );
    this.itemFormRef.saveMode = saveMode.PUT;
    this.itemFormRef.resetValuState();
    this.itemFormRef.selectedItemTypeName = data.productTypes?.[0]?.name ?? "";
    this.itemFormRef.selectedItemUomName = data.uom?.name ?? "";
    this.itemFormRef.selectedProductType = data.productTypes?.[0] ?? null;
    this.itemFormRef.selectedCategory = data.category ?? null;
    this.itemFormRef.catagoryTitle = data.category?.name ?? "";
    this.itemFormRef.selectedSubCategory = data.itemSubCategories ?? [];
    this.itemFormRef.selectedSubCategoryIds = (
      data.itemSubCategories ?? []
    ).map((item: any) => item.id?.toString() ?? "");
    this.itemFormRef.status = data.current_stock >= data.minimum_stock ? "Normal" : "Critical";
    this.itemFormRef.itemAttachmentsTab.isEdit = true;
    this.itemFormRef.itemAttachmentsTab.isPreview = true;

    this.getAssociateData(data);
  }

  processData(event: any): void {
    this.agGridRef?.refreshGridData(true);
  }

  downloadData(_event?: any): void {
    this.commonService
      .post<Blob>("item/export", {}, false, undefined, "blob")
      .subscribe({
        next: (res: Blob) => {
          const url = window.URL.createObjectURL(res);
          const a = document.createElement("a");
          a.href = url;
          a.download = "Exported Item.xlsx";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.toastService.show("export");
        },
        error: () => {
          this.toastService.show("error");
        },
      });
  }

  private getAssociateData(data: any): void {
    setTimeout(() => {
      this.itemFormRef?.setAssociateData(data);
    });
  }
}
