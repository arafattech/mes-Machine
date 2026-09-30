import { Component, EventEmitter, Output, ViewChild } from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableFilterOptionInput,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { saveMode } from "@app/shared/enums/saveMode";
import { Product } from "@app/shared/model/product";
import { ProductType } from "@app/shared/model/productType";
import { Variant } from "@app/shared/model/variant";
import { PricingFormComponent } from "./pricing-form/pricing-form.component";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { Localization } from "@app/shared/utilities/localization";
import { Permissions } from "@app/shared/enums/permissions";

@Component({
  selector: "app-pricing-plan",
  templateUrl: "./pricing-plan.component.html",
  styleUrl: "./pricing-plan.component.scss",
})
export class PricingPlanComponent {
  @ViewChild("agGridRef") agGridRef?: AgGridTableComponent;
  @ViewChild("itemForm") itemFormRef!: PricingFormComponent;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  @Output() triggerLoading: EventEmitter<void> = new EventEmitter<void>();
  @Output() refreshVariantTableLoading: EventEmitter<void> = new EventEmitter<void>();
  @Output() refreshVariantTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsInsertVariant = new EventEmitter<any>();

  Product = Product;
  product = new Product();
  Variants = Variant;
  showArrow = false;
  SelectedProduct = new Product().deserialize({ id: 0 });
  selectedRemoveVariant = new Variant().deserialize({});
  selectedVariant: Variant[] = [];
  editVariantModal: boolean = false;
  isLoading: boolean = false;
  isOpen: boolean = false;
  odata: boolean;
  openVariant: boolean = false;
  api: boolean;
  showVariant: boolean = false;
  variants: { [key: string]: boolean } = {};
  variant: Variant = new Variant().deserialize({});
  variantLists: Variant[] = [];
  ToastType: string = "";
  insertTitle: string = $localize`New`;
  headerTitle: string = `${$localize`Item`} ${$localize`List`}`;
  clone: boolean = false;

  layoutMode: "product" | "split" | "edit" = "product";

  isEditOpen: boolean = false;
  tableData: Product[] = [];
  public saveMode: string = saveMode.POST;
  public isListCollapsed: boolean = false;
  public isTabCollapsed: boolean = true;

  public localization = Localization;

  // ─── AG Grid config ───────────────────────────────────────────────────────

  private categoryOptions: AgGridTableFilterOptionInput[] = [];
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Product> = {
    type: "odata",
    endpoint: "Products",
    expand: "suppliers,productTypes,category,clients,plants,variants,uom",
    filter: "is_sellable eq true",
    sortBy: "custom_id",
    sortDirection: "desc",
    searchFields: ["item_code", "product_name", "model_number", "category.name"],
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Sellable Items`,
    showSearch: true,
    showScanner: true,
    showRowCount: true,
    showDownload: true,
    showNewButton: false,
    showSegmentButton: true,
    button1Text: $localize`All`,
    button2Text: $localize`Inactive`,
    button3Text: $localize`Active`,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 110px)",
  };

  constructor(
    private CommonService: CommonService,
    private rolePermissionService: RolePermissionService,
    private toastService: ToastService,
    private dateFormatter: DateFormatterService
  ) {
    this.odata = this.CommonService.odata;
    this.api = this.CommonService.api;
    this.columns = this.buildColumns();
    this.getCategory();
  }

  ngOnInit(): void {}

  toggleVariantView(): void {
    this.showVariant = !this.showVariant;
  }

  ngAfterViewInit() {
    setTimeout(() => {
      document.addEventListener("click", (e: any) => {
        if (e.target?.getAttribute("data-toggle-variant") !== null) {
          this.toggleVariantView();
        }
      });
    });
  }

  getCategory() {
    this.CommonService.get(
      "ItemCategories?$filter=is_active eq true&$select=id,name",
      true
    ).subscribe({
      next: (res: any) => {
        this.categoryOptions = (res?.value ?? []).map((c: any) => ({
          value: c.id,
          label: c.name,
        }));
        this.columns = this.buildColumns();
      },
      error: () => {},
    });
  }

  private buildColumns(): AgGridTableColumn<any>[] {
    return [
      {
        field: "is_active",
        headerName: $localize`Active`,
        width: 80,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        colId: "item_category_id",
        headerName: $localize`Category`,
        minWidth: 180,
        sortable: false,
        valueGetter: (params: any) => params.data?.category?.name ?? "",
        filterControl: {
          type: "multiSelect",
          options: this.categoryOptions,
          placeholder: $localize`Filter categories...`,
        },
      },
      {
        field: "item_code",
        headerName: $localize`Item Code`,
        minWidth: 120,
      },
      {
        field: "product_name",
        headerName: $localize`Item Name`,
        flex: 1,
        minWidth: 150,
      },
      {
        field: "model_number",
        headerName: $localize`Model`,
        minWidth: 120,
      },
      {
        field: "part_number",
        headerName: $localize`Part Number`,
        minWidth: 120,
        isSelected: false,
      },
      ...(this.rolePermissionService.hasPermission(
        Permissions.BASE_DATA_ITEM_VARIANTS_LIST
      )
        ? [
            {
              field: "has_variant",
              headerName: $localize`Has Variant`,
              width: 120,
              cellRenderer: AgGridBooleanCellRendererComponent,
              filter: false,
              sortable: false,
            } as AgGridTableColumn<any>,
          ]
        : []),
      {
        field: "rack_no",
        headerName: $localize`Rack Number`,
        minWidth: 110,
      },
      {
        field: "current_stock",
        headerName: $localize`Current Stock`,
        minWidth: 120,
      },
      {
        field: "minimum_stock",
        headerName: $localize`Minimum Stock`,
        minWidth: 120,
      },
      {
        field: "unit_price",
        headerName: $localize`Unit Price`,
        minWidth: 110,
      },
      {
        field: "created_at",
        headerName: $localize`Created on`,
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
  }

  processData(event: any) {
    this.refreshTable.emit(event);
    this.agGridRef?.refreshGridData(true);
  }

  handleRowSelect(data: any) {
    if (!data) return;
    this.isTabCollapsed = false;
    this.isListCollapsed = false;
    this.SelectedProduct = new Product().deserialize(data);
    this.itemFormRef.product = structuredClone(this.SelectedProduct);
    this.itemFormRef.saveMode = saveMode.PUT;
    this.itemFormRef.resetValuState();
    this.itemFormRef.selectedProductType = data.productTypes?.[0] ?? null;
    this.itemFormRef.selectedCategory = data.category ?? null;
    this.itemFormRef.catagoryTitle = data.category?.name ?? "";
    this.itemFormRef.selectedSubCategory = data.itemSubCategories ?? [];
    this.itemFormRef.selectedSubCategoryIds =
      this.itemFormRef.selectedSubCategory.map(
        (item: any) => item.id?.toString() ?? ""
      );
    this.editItem(this.SelectedProduct);
    setTimeout(() => {
      this.itemFormRef.refreshPricePlanTable();
    }, 200);
  }

  onCLickTabCollapsed() {
    this.isTabCollapsed = !this.isTabCollapsed;
  }
  onCLickListCollapsed() {
    this.isListCollapsed = !this.isListCollapsed;
  }

  cancelEdit() {
    this.isTabCollapsed = true;
  }

  newItem() {
    this.itemFormRef.isclone = false;
    this.isTabCollapsed = false;
    this.product.deserialize({});
    this.itemFormRef.resetForm();
    this.itemFormRef.reset();
    this.itemFormRef.open = true;
    this.itemFormRef.getCategory();
    this.itemFormRef.saveMode = saveMode.POST;
    this.itemFormRef.selectedSubCategory = [];
    this.itemFormRef.selectedSubCategoryIds = [];
    this.itemFormRef.catagoryTitle = "";
    this.itemFormRef.selectedProductType = new ProductType().deserialize({});
    this.itemFormRef.selectedCategory.deserialize({});
  }

  editItem(data: any) {
    this.product = data;
    this.itemFormRef.isclone = false;
    this.itemFormRef.open = true;
    this.itemFormRef.selectedItemTypeName = data.productTypes?.[0]?.name ?? "";
    this.itemFormRef.selectedItemUomName = data.uom?.name ?? "";
    this.saveMode = saveMode.PUT;
  }

  cloneItem(data: any) {
    this.itemFormRef.isclone = true;
    this.clone = true;
    this.product = new Product().deserialize(data);
    this.itemFormRef.selectedItemTypeName = data.productTypes?.[0]?.name ?? "";
    this.itemFormRef.selectedItemUomName = data.uom?.name ?? "";

    setTimeout(() => {
      if (data.category) {
        this.itemFormRef.selectedCategory = data.category ?? null;
        this.itemFormRef.catagoryTitle = data.category.name;
        this.itemFormRef.itemCodeLoad({
          model: "products",
          prefix: data.category.prefix ?? "",
          field: "item_code",
        });
      }
    }),
      200;

    this.saveMode = saveMode.POST;
    this.isTabCollapsed = false;
    this.itemFormRef.open = true;
  }

  deleteClick(data: any) {
    this.IsDelete.emit(`Products/${data}`);
  }

  downloadData(event: any) {
    this.isLoading = true;
    this.CommonService.post<Blob>(
      "item/export",
      {},
      this.api,
      undefined,
      "blob"
    ).subscribe({
      next: (res: Blob) => {
        const url = window.URL.createObjectURL(res);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Expoted Item.xlsx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        this.toastService.show("export");
        this.isLoading = false;
      },
      error: (error: any) => {
        this.isLoading = false;
        this.toastService.show("error");
      },
    });
  }
}
