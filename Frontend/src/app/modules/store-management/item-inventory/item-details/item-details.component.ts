import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  viewChild,
  ViewChild,
} from "@angular/core";

import { CommonService } from "@app/services/common-service/common.service";
import { MediaService } from "@app/services/media-service.js";
import { ProductFormComponent } from "@base-data-module/product-management/product-type/product-form/product-form.component";
import { UomFormComponent } from "@base-data-module/product-management/uom/uom-form/uom-form.component";
import { AssosiateComponent } from "@shared/components/assosiate/assosiate.component";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { AttachmentUploadComponent } from "@shared/components/attachment-upload/attachment-upload.component";
import { Client } from "@shared/model/client";
import { ItemCategory } from "@shared/model/itemCategory";
import { ItemSubCategory } from "@shared/model/itemSubCategory";
import { Plant } from "@shared/model/plant";
import { Product } from "@shared/model/product";
import { ProductType } from "@shared/model/productType";
import { Supplier } from "@shared/model/supplier";
import { Uom } from "@shared/model/uom";
import { Variant } from "@shared/model/variant.js";
import { firstValueFrom } from "rxjs";
import { CategoryFormComponent } from "@base-data-module/product-management/item-category/category-form/category-form.component.js";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import ValueState from "@ui5/webcomponents-base/dist/types/ValueState.js";
import { ToastService } from "@app/services/toast-service/toast.service";
import { VariantFormComponent } from "@base-data-module/product-management/variant/variant-form/variant-form.component.js";
import { currency } from "@shared/enums/currency.js";
import { SubCategoryFormComponent } from "@base-data-module/product-management/item-sub-category/sub-category-form/sub-category-form.component.js";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { PermissionGuard } from "@app/services/permission-guard/permission.guard";
import { Permissions } from "@app/shared/enums/permissions";
@Component({
  selector: 'app-item-details',
  templateUrl: './item-details.component.html',
  styleUrl: './item-details.component.scss',
})
export class ItemDetailsComponent {
  @ViewChild('productForm') productFormRef!: ProductFormComponent;
  @ViewChild('uomForm') uomFormRef!: UomFormComponent;
  @ViewChild('subCatForm') subCatFormRef!: SubCategoryFormComponent;
  @ViewChild('categoryForm') categoryFormRef!: CategoryFormComponent;
  @ViewChild('variantForm') variantFormRef!: VariantFormComponent;
  @ViewChild('suppliersAssosiate')
  public suppliersAssosiate!: AssosiateComponent;
  @ViewChild('clientAssosiate')
  public clientAssosiate!: AssosiateComponent;
  @ViewChild('plantAssosiate')
  public plantAssosiate!: AssosiateComponent;

  @Input() saveMode: string = saveMode.POST;
  @Input() isVariantList: boolean = false;
  @Input() isclone: boolean = false;
  @Input() product: Product = new Product();

  @Output() closeFrom = new EventEmitter<void>();
  @Output() getAttachmentsTriggered = new EventEmitter<void>();
  @Output() RefreshTable = new EventEmitter<any>();
  @Output() refreshTrigger: EventEmitter<any> = new EventEmitter<any>();
  @Output() IsDelete = new EventEmitter<any>();

  productType: ProductType = new ProductType().deserialize({});
  itemCategory: ItemCategory = new ItemCategory().deserialize({});
  uom: Uom = new Uom();
  variant: Variant = new Variant().deserialize({});
  @ViewChild('itemAttachmentsTab')
  itemAttachmentsTab!: AttachmentUploadComponent;
  selectedVariantType: string = '';
  loading: boolean = false;
  odata: boolean;
  api: boolean;
  Permission?: string = '';
  plantList = Plant;
  clientList = Client;
  SupplierList = Supplier;
  productTypeList = ProductType;
  itemCategoryList = ItemCategory;
  ItemVariant = Variant;
  Plants: Plant[] = [];
  Clients: Client[] = [];
  Suppliers: Supplier[] = [];
  ProductTypes: ProductType[] = [];
  ItemCategories: ItemCategory[] = [];
  resId: string = '';
  isAddError: boolean = false;
  ItemSubCategories: ItemSubCategory[] = [];
  categoryValidationMessages: string[] = [];
  selectedCategoryId: number | null = null;
  isErrorMessage: string = '';
  IsSupplier: boolean = false;
  variantLists: Variant[] = [];
  Variants: Variant[] = [];
  variantIds: string[] = [];
  Variant = new Variant().deserialize({});
  IsAssosiate: boolean = false;
  open: boolean = false;
  openCheckClone: boolean = false;
  checkCloneValidate: boolean = false;
  selectedTab = 'coreData';
  isAddDialogOpen: boolean = false;
  showUomSection: boolean = false;
  showVariantSection: boolean = false;
  Uomlists: Uom[] = [];
  openVariant: boolean = false;
  isAddProductTypeDialogOpen: boolean = false;
  productTypeLists: ProductType[] = [];
  buttonText: string = 'Add More';
  buttonIcon: string = 'add';
  catagoryPrefix: string = '';
  catagoryTitle: string = '';
  selectedCategory: ItemCategory = new ItemCategory();
  selectedSubCategory: ItemSubCategory[] = [];
  selectedProductType: ProductType | null = null;
  selectedSubCategoryIds: string[] = [];
  isVariantEdit: boolean = false;
  selectedVariantId: string = '';
  isVariantTabOpen: boolean;
  showAddMore: boolean = false;
  className: string = 'hidden';
  selectedProductTypeId: string | null = null;
  newlyAddedUom: Uom | null = null;
  newlyAddedProductType: ProductType | null = null;
  isNewProductTypeAdded: boolean = false;
  openVariantEdit: boolean = false;
  ToastType: 'add' | 'edit' | 'error' = 'add';
  status: string = '';
  selectedItemTypeName: string = '';
  selectedItemUomName: string = '';
  supplierTableTitle: string = `${$localize`Supplier`} ${$localize`List`}`;
  clientTableTitle: string = `${$localize`Client`} ${$localize`List`}`;
  plantTableTitle: string = `${$localize`Plant`} ${$localize`List`}`;
  variantTableTitle: string = `${$localize`Variant`} ${$localize`List`}`;
  logsTableTitle: string = `${$localize`Requisition Logs`}`;
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  public currency = currency;
  public permissions = Permissions;
  generateCode: string = '';
  valueStateOptions = {
    name: ValueState.None,
    code: ValueState.None,
    catagory: ValueState.None,
    unit_price: ValueState.None,
    uom: ValueState.None,
    itemType: ValueState.None,
  };

  // ─── AG Grid (read-only detail tables) ──────────────────────────────────────
  supplierColumns: AgGridTableColumn<any>[] = [];
  clientColumns: AgGridTableColumn<any>[] = [];
  plantColumns: AgGridTableColumn<any>[] = [];
  variantColumnsDef: AgGridTableColumn<any>[] = [];
  logsColumns: AgGridTableColumn<any>[] = [];

  supplierDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  clientDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  plantDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  variantStaticDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  variantOdataDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'Products',
    filter: 'parent_id eq 0',
    sortBy: 'id',
    sortDirection: 'desc',
    pageSize: 50,
  };
  logsDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'PurchaseRequisitions',
    expand: 'requestBy,department,sprItems($expand=item($expand=category,uom))',
    searchFields: ['custom_id', 'requestBy.name', 'department.name', 'urgency'],
    sortBy: 'id',
    sortDirection: 'desc',
    filter: `type eq 'SR' and status eq 'FINAL_APPROVAL' and sprItems/any(i:i/product_id eq ${this.product?.id ?? 0})`,
  };

  supplierToolbar: AgGridTableToolbarConfig = {
    headerTitle: this.supplierTableTitle,
    showSearch: false,
    showNewButton: false,
    showDownload: false,
  };
  clientToolbar: AgGridTableToolbarConfig = {
    headerTitle: this.clientTableTitle,
    showSearch: false,
    showNewButton: false,
    showDownload: false,
  };
  plantToolbar: AgGridTableToolbarConfig = {
    headerTitle: this.plantTableTitle,
    showSearch: false,
    showNewButton: false,
    showDownload: false,
  };
  logsToolbar: AgGridTableToolbarConfig = {
    headerTitle: this.logsTableTitle,
    showSearch: true,
    showNewButton: false,
    showDownload: false,
  };
  variantToolbar: AgGridTableToolbarConfig = {
    headerTitle: this.variantTableTitle,
    showSearch: false,
    showNewButton: false,
    showDownload: false,
  };
  detailGridDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 340px)',
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private mediaService: MediaService,
    private cdRef: ChangeDetectorRef,
    public rolePermissionService: RolePermissionService,
    private dateFormatter: DateFormatterService,
  ) {
    this.odata = this.commonService.odata;
    this.api = this.commonService.api;
    this.isVariantTabOpen = false;
    this.logsColumns = this.buildLogsColumns();
  }

  public hasPermission(permission: string): boolean {
    return this.rolePermissionService.hasPermission(permission);
  }

  ngOnInit(): void {
    this.buildDetailColumns();
    this.getBatchData();
  }

  private buildDetailColumns(): void {
    const associateColumns = (): AgGridTableColumn<any>[] => [
      {
        field: 'is_active',
        headerName: this.localization.Active,
        width: 90,
        minWidth: 80,
        sortable: false,
        filter: false,
        cellRenderer: AgGridBooleanCellRendererComponent,
      },
      { field: 'custom_id', headerName: this.localization.ID, width: 120 },
      { field: 'name', headerName: this.localization.Name, minWidth: 160 },
      {
        field: 'created_at',
        headerName: this.localization.CreatedAt,
        width: 160,
        filter: false,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
    ];

    this.supplierColumns = associateColumns();
    this.clientColumns = associateColumns();
    this.plantColumns = associateColumns();

    this.variantColumnsDef = [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        width: 90,
        minWidth: 80,
        sortable: false,
        filter: false,
        cellRenderer: AgGridBooleanCellRendererComponent,
      },
      {
        colId: 'product_name',
        headerName: $localize`Variant Name`,
        minWidth: 180,
        valueGetter: (p: any) =>
          p.data?.product_name || p.data?.variant_value || '-',
      },
      {
        colId: 'unit_price',
        headerName: $localize`Unit Price`,
        minWidth: 150,
        type: 'numericColumn',
        valueGetter: (p: any) =>
          p.data?.unit_price || p.data?.variant_unit_price || '-',
      },
    ];
  }

  private buildLogsColumns(): AgGridTableColumn<any>[] {
    const cols: AgGridTableColumn<any>[] = [
      {
        field: 'custom_id',
        headerName: $localize`Indent No`,
        minWidth: 100,
        width: 120,
      },
      {
        colId: 'requestBy.name',
        headerName: $localize`Requested By`,
        flex: 1,
        minWidth: 140,
        sortable: false,
        valueGetter: (p: any) => p.data?.requestBy?.name ?? '',
      },
      {
        colId: 'department.name',
        headerName: $localize`Department`,
        flex: 1,
        minWidth: 140,
        sortable: false,
        valueGetter: (p: any) => p.data?.department?.name ?? '',
      },
      {
        field: 'request_date',
        headerName: $localize`Request Date`,
        minWidth: 130,
        hide: true,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
      {
        field: 'required_by',
        headerName: $localize`Required By`,
        minWidth: 130,
        dataType: GridTableColumnDataType.Date,
        valueFormatter: ({ value }: any) =>
          value
            ? this.dateFormatter.formatDate(value, true, false, false, false, false)
            : '',
      },
      {
        field: 'urgency',
        headerName: $localize`Urgency`,
        minWidth: 110,
        width: 120,
        hide: true,
      },
      {
        colId: 'approved_qty',
        headerName: $localize`Approved Qty`,
        width: 140,
        type: 'numericColumn',
        sortable: false,
        filter: false,
        floatingFilter: false,
        valueGetter: (p: any) =>
          (p.data?.sprItems ?? []).find(
            (i: any) => Number(i.product_id) === Number(this.product?.id),
          )?.approved_qty ?? '',
      },
    ];

    return cols;
  }

  // Parent feeds the associate (static) tables + sets the variant OData filter.
  setAssociateData(data: any): void {
    this.Suppliers = data?.suppliers ?? [];
    this.Clients = data?.clients ?? [];
    this.Plants = data?.plants ?? [];

    this.supplierDataSource = {
      ...this.supplierDataSource,
      data: [...this.Suppliers],
    };
    this.clientDataSource = {
      ...this.clientDataSource,
      data: [...this.Clients],
    };
    this.plantDataSource = {
      ...this.plantDataSource,
      data: [...this.Plants],
    };
    this.variantStaticDataSource = {
      ...this.variantStaticDataSource,
      data: [...(this.product?.variants ?? [])],
    };
    this.variantOdataDataSource = {
      ...this.variantOdataDataSource,
      filter: `parent_id eq ${this.product?.id ?? 0}`,
    };
    this.logsDataSource = {
      ...this.logsDataSource,
      filter: `type eq 'SR' and status eq 'FINAL_APPROVAL' and sprItems/any(i:i/product_id eq ${this.product?.id ?? 0})`,
    };
  }

  resetValuState() {
    this.valueStateOptions = {
      name: ValueState.None,
      code: ValueState.None,
      catagory: ValueState.None,
      unit_price: ValueState.None,
      uom: ValueState.None,
      itemType: ValueState.None,
    };
  }

  getCategory() {
    this.commonService
      .get(
        `ItemCategories?$orderby=id desc&$filter=is_active eq true`,
        this.odata,
      )
      .subscribe({
        next: (response: any) => {
          this.ItemCategories = response.value.map((item: any) =>
            new ItemCategory().deserialize(item),
          );
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  loadProductTypes() {
    this.commonService
      .get('ProductTypes?$orderby=id desc&$filter=is_active eq true')
      .subscribe({
        next: (res: any) => {
          this.productTypeLists =
            res.value?.map((item: any) =>
              new ProductType().deserialize(item),
            ) || [];
        },
        error: (err) => console.error(err),
      });
  }

  LoadUomList() {
    this.commonService
      .get('Uoms?$orderby=id desc&$filter=is_active eq true', this.odata)
      .subscribe({
        next: (response: any) => {
          this.Uomlists = response.value
            .filter((item: any) => item.id && item.name)
            .map((item: any) => new Uom().deserialize(item));
          if (this.product.uom_id) {
            const matchedUom = this.Uomlists.find(
              (u) => u.id?.toString() === this.product.uom_id?.toString(),
            );
            if (matchedUom) {
              this.selectedItemUomName = matchedUom.name;
            }
          }
          if (this.newlyAddedUom) {
            this.Uomlists = [this.newlyAddedUom, ...this.Uomlists];
            this.product.uom_id = this.newlyAddedUom.id?.toString() || '';
            this.selectedItemUomName = this.newlyAddedUom.name;
            this.newlyAddedUom = null;
          }
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  getBatchData() {
    const batchPayload = {
      requests: [
        {
          id: '1',
          method: 'GET',
          url: '/odata/ItemCategories?$orderby=id desc&$filter=is_active eq true',
        },
        {
          id: '2',
          method: 'GET',
          url: '/odata/Variants?$orderby=id desc&$filter=is_active eq true',
        },
        {
          id: '3',
          method: 'GET',
          url: '/odata/ProductTypes?$orderby=id desc&$filter=is_active eq true',
        },
        {
          id: '4',
          method: 'GET',
          url: '/odata/Uoms?$orderby=id desc&$filter=is_active eq true',
        },
      ],
    };

    this.commonService.post('$batch', batchPayload, this.odata).subscribe({
      next: (res: any) => {
        const responses = res.responses;

        const itemCategoriesRes = responses.find((r: any) => r.id === '1');
        const variantsRes = responses.find((r: any) => r.id === '2');
        const productTypesRes = responses.find((r: any) => r.id === '3');
        const uomsRes = responses.find((r: any) => r.id === '4');

        // Deserialize and assign responses
        if (itemCategoriesRes?.body?.value) {
          this.ItemCategories = itemCategoriesRes.body.value.map((item: any) =>
            new ItemCategory().deserialize(item),
          );
        }

        if (variantsRes?.body?.value) {
          this.variantLists = variantsRes.body.value.map((item: any) =>
            new Variant().deserialize(item),
          );
        }

        if (productTypesRes?.body?.value) {
          this.productTypeLists = productTypesRes.body.value.map((item: any) =>
            new ProductType().deserialize(item),
          );
        }

        if (uomsRes?.body?.value) {
          this.Uomlists = uomsRes.body.value
            .filter((item: any) => item.id && item.name)
            .map((item: any) => new Uom().deserialize(item));

          if (this.newlyAddedUom) {
            this.Uomlists = [this.newlyAddedUom, ...this.Uomlists];
            this.product.uom_id = this.newlyAddedUom.id?.toString() || '';
            this.newlyAddedUom = null;
          }
        }

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error('Batch request failed', err);
      },
    });
  }
  // ===================================  Category ===================================
  onCategorySelection(event: any) {
    const rawId = event.detail.item?.id;
    const selectedId =
      rawId !== null && rawId !== undefined ? Number(rawId) : undefined;

    this.catagoryPrefix = event.detail.item?.value ?? '';
    this.catagoryTitle = event.detail.item?.text ?? '';
    this.selectedCategory = new ItemCategory().deserialize({
      id: selectedId,
      prefix: this.catagoryPrefix,
      name: this.catagoryTitle,
    });
    this.product.item_category_id = selectedId || null;
    this.refreshTrigger.emit();
  }
  onSubcategorySelection(event: any) {
    const selectedItems = event.detail.items || [];
    this.selectedSubCategory = selectedItems.map((item: any) => {
      return {
        id: item.id,
        name: item.text,
        category_id: this.selectedCategory.id,
      };
    });
  }

  getSubcategory(categoryId: any) {
    this.commonService
      .get(`ItemSubCategories?$filter=category_id eq ${categoryId}`, this.odata)
      .subscribe({
        next: (response: any) => {
          this.ItemSubCategories = response.value.map((item: any) =>
            new ItemSubCategory().deserialize(item),
          );
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  variantIdinArray() {
    if (this.product && this.product.variants) {
      this.variantIds = this.product.variants.map((variant: any) => variant.id);
    } else {
      this.variantIds = [];
    }
  }

  associateTableColum() {
    const columns = [
      {
        accessor: 'custom_id',
      },
      {
        accessor: 'name',
      },
    ];
    return columns;
  }

  stripPrefix(code: string): string {
    if (!code) return '';
    const parts = code.split('-');
    if (parts.length <= 1) return code;
    parts.shift();
    return parts.join('-');
  }
  onTabSelect(event: any) {
    this.selectedTab = event.detail.tab.id;
    if (this.selectedTab == 'attachments' && this.saveMode === saveMode.PUT)
      this.itemAttachmentsTab?.loadInputImages();
  }
  onUomSelectFocus($event?: any) {
    if ($event) {
      const item = $event.detail.item;
      if (item) {
        this.product.uom_id = item.id?.toString() || '';
        this.selectedItemUomName = item.text || '';
      }
    }
  }
  onVariantSelectFocus() {
    this.showVariantSection = true;
  }

  onItemTypeSelectFocus(e: any) {
    const item = e.detail?.item;
    if (!item) {
      this.selectedProductType = null;
      this.selectedItemTypeName = '';
    } else {
      this.selectedProductType = new ProductType().deserialize({
        id: item.id,
        name: item.text,
      });
      this.selectedItemTypeName = item.text || '';
      this.product.productTypes = [this.selectedProductType];
    }
  }
  onRefreshTable(type: string) {
    switch (type) {
      case 'item_type':
        this.loadProductTypes();
        break;
      case 'uom':
        this.LoadUomList();
        break;
      case 'category':
        this.getCategory();
        break;
      default:
        break;
    }
  }

  onCurrencyChange($event: any) {
    const currency = $event.detail.item?.text;
    this.product.currency = currency;
    this.calculateAmount();
    this.cdRef.detectChanges();
  }

  calculateAmount() {
    const rate = parseFloat((this.product.price_in_bdt as string) || '0');
    const value = parseFloat((this.product.price_in_usd as string) || '0');

    if (!isNaN(rate) && !isNaN(value)) {
      this.product.unit_price = (rate * value).toString();
    } else {
    }
  }

  onVariantChange(event: any): void {
    const item = event?.detail?.item as HTMLElement | undefined;
    const text = (item as any)?.text ?? '';
    const dataId = item?.getAttribute('data-id') ?? '';

    this.variant.variant_name = text;
    this.variant.variant_id = dataId || undefined;
  }

  onVariantCurrencyChange(event: any): void {
    const currency = event.detail.item?.text;
    this.variant.variant_currency = currency;
    if (currency !== currency.BDT) {
      this.variant.variant_price_in_bdt = '';
      this.variant.variant_price_in_usd = '';
      this.variant.variant_unit_price = '';
    }
  }

  calculateVariantUsdAmount(): void {
    const rate = parseFloat(this.variant.variant_price_in_bdt || '0') || 0;
    const usdValue = parseFloat(this.variant.variant_price_in_usd || '0') || 0;
    if (rate && usdValue) {
      this.variant.variant_unit_price = (rate * usdValue).toString();
    } else {
      this.variant.variant_unit_price = '';
    }
  }
  removeVariant(data: any): void {
    if (this.saveMode === saveMode.POST) {
      this.product.variants =
        this.product?.variants?.filter((v) => v !== data) ?? [];
      this.Variants = [...this.product.variants];
      this.toastService.show('delete');
      return;
    }

    if (this.saveMode === saveMode.PUT) {
      if (data?.id) {
        this.IsDelete.emit(`Products/${data.id}`);
      } else {
        this.product.variants =
          this.product?.variants?.filter((v) => v !== data) ?? [];
        this.Variants = [...this.product.variants];
        this.toastService.show('delete');
      }
      return;
    }

    console.warn('Invalid delete operation:', data);
    this.toastService.show('error');
  }

  public resetForm(): void {
    this.variant = new Variant().deserialize({
      variant_currency: 'BDT',
      variant_value: '',
    });
    this.selectedVariantType = '';
    this.selectedItemUomName = '';
    this.selectedItemTypeName = '';
  }

  autoUomAdded(newUom: any) {
    this.Uomlists = [newUom, ...this.Uomlists];
    this.product.uom_id = newUom.id?.toString() || '';
    this.selectedItemUomName = newUom.name;
  }
  autoTypeAdded(newType: any) {
    this.productTypeLists = [newType, ...this.productTypeLists];
    this.selectedProductType = new ProductType().deserialize({ newType });
    this.selectedProductType = new ProductType().deserialize({
      id: newType.id,
      name: newType.name,
    });
    this.product.productTypes = [this.selectedProductType];
    this.selectedItemTypeName = newType?.name || '';
  }
  autoCategoryAdded(newCat: any) {
    this.ItemCategories = [newCat, ...this.ItemCategories];
    this.selectedCategory = new ItemCategory().deserialize({
      id: newCat.id,
      prefix: newCat.prefix,
      name: newCat.name,
    });
    this.selectedCategoryId = newCat.id || null;
    this.catagoryTitle = newCat.name;
  }
  onCancel() {
    this.open = false;
    this.resetValuState();
    this.resetForm();
  }
  reset() {
    this.product = new Product().deserialize({});
  }
}
