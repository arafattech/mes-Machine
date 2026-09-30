import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';

import { CommonService } from '@app/services/common-service/common.service';
import { MediaService } from '@app/services/media-service.js';
import { ProductFormComponent } from '@base-data-module/product-management/product-type/product-form/product-form.component';
import { UomFormComponent } from '@base-data-module/product-management/uom/uom-form/uom-form.component';
import { AssosiateComponent } from '@shared/components/assosiate/assosiate.component';
import { AttachmentUploadComponent } from '@shared/components/attachment-upload/attachment-upload.component';
import { Client } from '@shared/model/client';
import { ItemCategory } from '@shared/model/itemCategory';
import { ItemSubCategory } from '@shared/model/itemSubCategory';
import { Plant } from '@shared/model/plant';
import { Product } from '@shared/model/product';
import { ProductType } from '@shared/model/productType';
import { Supplier } from '@shared/model/supplier';
import { Uom } from '@shared/model/uom';
import { Variant } from '@shared/model/variant.js';
import { firstValueFrom } from 'rxjs';
import { CategoryFormComponent } from '@base-data-module/product-management/item-category/category-form/category-form.component.js';
import { saveMode } from '@shared/enums/saveMode';
import { Localization } from '@shared/utilities/localization';
import ValueState from '@ui5/webcomponents-base/dist/types/ValueState.js';
import { ToastService } from '@app/services/toast-service/toast.service';
import { VariantFormComponent } from '@base-data-module/product-management/variant/variant-form/variant-form.component.js';
import { currency } from '@shared/enums/currency.js';
import { SubCategoryFormComponent } from '@base-data-module/product-management/item-sub-category/sub-category-form/sub-category-form.component.js';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { PermissionGuard } from '@app/services/permission-guard/permission.guard';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridBooleanCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';
@Component({
  selector: 'app-item-form',
  templateUrl: './item-form.component.html',
  styleUrl: './item-form.component.scss',
})
export class ItemFormComponent {
  @ViewChild('productForm') productFormRef!: ProductFormComponent;
  @ViewChild('uomForm') uomFormRef!: UomFormComponent;
  @ViewChild('subCatForm') subCatFormRef!: SubCategoryFormComponent;
  @ViewChild('categoryForm') categoryFormRef!: CategoryFormComponent;
  @ViewChild('variantForm') variantFormRef!: VariantFormComponent;
  @ViewChild('variantEditTable')
  public variantEditTableRef!: AgGridTableComponent;
  @ViewChild('suppliersAssosiate')
  public suppliersAssosiate!: AssosiateComponent;
  @ViewChild('clientAssosiate')
  public clientAssosiate!: AssosiateComponent;
  @ViewChild('plantAssosiate')
  public plantAssosiate!: AssosiateComponent;
  @Input() saveMode: string = saveMode.POST;
  @Input() isVariantList: boolean = false;
  @Input() isclone: boolean = false;

  @Output() closeFrom = new EventEmitter<void>();
  @Input() product: Product = new Product();
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
  // rolePermissions: RolePermissionService = new RolePermissionService();
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
  selectedItemTypeName: string = '';
  selectedItemUomName: string = '';

  supplierDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  supplierToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Supplier`} ${$localize`List`}`,
    showNewButton: true,
    addButtonText: $localize`Associate`,
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
    showDownload: false,
  };
  supplierDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 347px)',
    fillEmptyRows: true,
  };
  supplierColumns: AgGridTableColumn<any>[] = [
    {
      field: 'is_active',
      headerName: Localization.Active,
      cellRenderer: AgGridBooleanCellRendererComponent,
      minWidth: 80,
      width: 90,
      filter: false,
      sortable: false,
    },
    {
      field: 'custom_id',
      headerName: $localize`ID`,
      minWidth: 100,
      width: 130,
      filter: false,
    },
    { field: 'name', headerName: $localize`Name`, minWidth: 180, flex: 1 },
    {
      field: 'created_at',
      headerName: Localization.CreatedAt,
      minWidth: 130,
      width: 150,
      filter: false,
    },
  ];

  plantDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  plantToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Plant`} ${$localize`List`}`,
    showNewButton: true,
    addButtonText: $localize`Associate`,
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
    showDownload: false,
  };
  plantDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 347px)',
    fillEmptyRows: true,
  };
  plantColumns: AgGridTableColumn<any>[] = [
    {
      field: 'is_active',
      headerName: Localization.Active,
      cellRenderer: AgGridBooleanCellRendererComponent,
      minWidth: 80,
      width: 90,
      filter: false,
      sortable: false,
    },
    {
      field: 'custom_id',
      headerName: $localize`ID`,
      minWidth: 100,
      width: 130,
      filter: false,
    },
    { field: 'name', headerName: $localize`Name`, minWidth: 180, flex: 1 },
    {
      field: 'created_at',
      headerName: Localization.CreatedAt,
      minWidth: 130,
      width: 150,
      filter: false,
    },
  ];

  clientDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  clientToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Client`} ${$localize`List`}`,
    showNewButton: true,
    addButtonText: $localize`Associate`,
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
    showDownload: false,
  };
  clientDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 347px)',
    fillEmptyRows: true,
  };
  clientColumns: AgGridTableColumn<any>[] = [
    {
      field: 'is_active',
      headerName: Localization.Active,
      cellRenderer: AgGridBooleanCellRendererComponent,
      minWidth: 80,
      width: 90,
      filter: false,
      sortable: false,
    },
    {
      field: 'custom_id',
      headerName: $localize`ID`,
      minWidth: 100,
      width: 130,
      filter: false,
    },
    { field: 'name', headerName: $localize`Name`, minWidth: 180, flex: 1 },
    {
      field: 'created_at',
      headerName: Localization.CreatedAt,
      minWidth: 130,
      width: 150,
      filter: false,
    },
  ];

  variantDataSource: AgGridTableODataSourceConfig = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  variantToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: `${$localize`Variant`} ${$localize`List`}`,
    showNewButton: true,
    addButtonText: Localization.New,
    showSearch: false,
    showRowCount: false,
    showSegmentButton: false,
    showDownload: false,
  };
  variantDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 347px)',
    fillEmptyRows: true,
  };
  variantColumns: AgGridTableColumn<any>[] = [
    {
      field: 'is_active',
      headerName: Localization.Active,
      cellRenderer: AgGridBooleanCellRendererComponent,
      minWidth: 80,
      width: 90,
      filter: false,
      sortable: false,
    },
    {
      colId: 'product_name',
      headerName: $localize`Variant Name`,
      minWidth: 180,
      flex: 1,
      valueGetter: (params: any) =>
        params.data?.product_name || params.data?.variant_value || '-',
    },
    {
      colId: 'unit_price',
      headerName: $localize`Unit Price`,
      minWidth: 150,
      type: 'numericColumn',
      filter: false,
      valueGetter: (params: any) =>
        params.data?.unit_price || params.data?.variant_unit_price || '-',
    },
  ];
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  public currency = currency;
  generateCode: string = '';
  valueStateOptions = {
    name: ValueState.None,
    code: ValueState.None,
    catagory: ValueState.None,
    unit_price: ValueState.None,
    uom: ValueState.None,
    itemType: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private mediaService: MediaService,
    private cdRef: ChangeDetectorRef,
    public rolePermissionService: RolePermissionService,
  ) {
    this.odata = this.commonService.odata;
    this.api = this.commonService.api;
    this.isVariantTabOpen = false;
  }

  public hasPermission(permission: string): boolean {
    return this.rolePermissionService.hasPermission(permission);
  }

  ngOnInit(): void {
    this.getBatchData();
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

  loadVariants() {
    this.commonService
      .get('Variants?$orderby=id desc&$filter=is_active eq true', this.odata)
      .subscribe({
        next: (response: any) => {
          this.variantLists = (response?.value ?? [])
            .map((item: any) => new Variant().deserialize(item))
            .map((v: any) => ({
              ...v,
              name: (v?.name ?? '').toString(),
              id: (v?.id ?? '').toString(),
            }))
            .filter((v: any) => v.name.length > 0);
          this.cdRef.detectChanges();
        },
        error: (err) => console.error(err),
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
    this.itemCodeLoad({
      model: 'products',
      prefix: this.catagoryPrefix,
      field: 'item_code',
    });
    this.checkValidation({ target: { value: selectedId } }, 'category');
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

  itemCodeLoad(data?: any) {
    this.product.item_code = this.catagoryPrefix;
    this.commonService.post(`generate-id`, data, this.api).subscribe({
      next: (response: any) => {
        if (this.isclone) {
          this.generateCode = response.code;
        } else {
          this.product.item_code = response.code;
        }
        this.checkValidation({ target: { value: response.code } }, 'code');
        this.checkValidation({ target: { value: response.code } }, 'code');
        this.cdRef.detectChanges();
      },
      error: (error: any) => {
        console.error('Error Generating Item Code:', error);
      },
    });
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

  // =================================== supplier assosiate ===================================

  openSupplierModal() {
    this.suppliersAssosiate.open = true;
    this.suppliersAssosiate.bindingData = this.Suppliers;
  }

  getSupplierFromAssosiate(selectedItems: any) {
    this.Suppliers = selectedItems;
    this.supplierDataSource = {
      ...this.supplierDataSource,
      data: [...this.Suppliers],
    };
  }

  removeSupplierData(data: any): void {
    this.Suppliers = this.Suppliers.filter((item: any) => item.id !== data.id);
    this.supplierDataSource = {
      ...this.supplierDataSource,
      data: [...this.Suppliers],
    };
  }

  // ============================== client assosiate ==============================
  openClientModal() {
    this.clientAssosiate.open = true;
    this.clientAssosiate.bindingData = this.Clients;
  }

  getClientFromAssosiate(selectedItems: any) {
    this.Clients = selectedItems;
    this.clientDataSource = {
      ...this.clientDataSource,
      data: [...this.Clients],
    };
  }

  removeClientData(data: any) {
    this.Clients = this.Clients.filter((item: any) => item.id != data.id);
    this.clientDataSource = {
      ...this.clientDataSource,
      data: [...this.Clients],
    };
  }
  // ============================== plant assosiate ==============================
  openPlantModal() {
    this.plantAssosiate.open = true;
    this.plantAssosiate.bindingData = this.Plants;
  }

  getPlantFromAssosiate(selectedItems: any) {
    this.Plants = selectedItems;
    this.plantDataSource = { ...this.plantDataSource, data: [...this.Plants] };
  }

  removePlantData(data: any) {
    this.Plants = this.Plants.filter((item: any) => item.id !== data.id);
    this.plantDataSource = { ...this.plantDataSource, data: [...this.Plants] };
  }

  validateForm(): boolean {
    let isValid = true;
    if (this.product.product_name?.trim()) {
      this.valueStateOptions.name = ValueState.None;
    } else {
      this.valueStateOptions.name = ValueState.Negative;
      isValid = false;
    }
    if (this.product.item_code?.trim() || this.generateCode?.trim()) {
      this.valueStateOptions.code = ValueState.None;
    } else {
      this.valueStateOptions.code = ValueState.Negative;
      isValid = false;
    }
    if (this.product.item_category_id) {
      this.valueStateOptions.catagory = ValueState.None;
    } else {
      this.valueStateOptions.catagory = ValueState.Negative;
      isValid = false;
    }

    if (this.product.uom_id) {
      this.valueStateOptions.uom = ValueState.None;
    } else {
      this.valueStateOptions.uom = ValueState.Negative;
      isValid = false;
    }
    // * ==========================
    // Commented for future use
    // ==========================*
    // if ((this.product.productTypes ?? []).length > 0) {
    //   this.valueStateOptions.itemType = ValueState.None;
    // } else {
    //   this.valueStateOptions.itemType = ValueState.Negative;
    //   isValid = false;
    // }

    return isValid;
  }

  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : '';
    switch (field) {
      case 'name':
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.product.product_name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;

      case 'code':
        if (!this.product.item_code?.trim() && !this.generateCode?.trim()) {
          this.valueStateOptions.code = ValueState.Negative;
        } else {
          this.product.item_code = value;
          this.generateCode = value;
          this.valueStateOptions.code = ValueState.None;
        }
        break;

      case 'category':
        if (!this.selectedCategory.id) {
          this.valueStateOptions.catagory = ValueState.Negative;
        } else {
          this.product.itemCategories = [this.selectedCategory];
          this.valueStateOptions.catagory = ValueState.None;
        }
        break;
      case 'unit_price':
        if (!value.trim()) {
          this.valueStateOptions.unit_price = ValueState.Negative;
        } else {
          this.product.unit_price = value;
          this.valueStateOptions.unit_price = ValueState.None;
        }
        break;

      case 'itemType':
        if ((this.product.productTypes ?? []).length > 0) {
          this.valueStateOptions.itemType = ValueState.None;
        } else {
          this.valueStateOptions.itemType = ValueState.Negative;
        }
        break;

      case 'Item_uom':
        if (!value) {
          this.valueStateOptions.uom = ValueState.Negative;
        } else {
          this.product.uom_id = value.toString();
          this.valueStateOptions.uom = ValueState.None;
        }
        break;

      default:
        break;
    }
  }
  stripPrefix(code: string): string {
    if (!code) return '';
    const parts = code.split('-');
    if (parts.length <= 1) return code;
    parts.shift();
    return parts.join('-');
  }

  onSaveType() {
    if (!this.validateForm()) {
      this.selectedTab = 'coreData';
      this.cdRef.detectChanges();
      return;
    }
    if (this.product.has_variant) {
      this.product.is_variant = false;
    } else {
      this.product.is_variant = true;
    }
    let url = '';
    let request$;

    if (this.saveMode === saveMode.POST && !this.isclone) {
      url = 'Products';
      this.ToastType = 'add';
      this.product.item_category_id = this.selectedCategory.id || null;
      this.loading = false;
      request$ = this.commonService.post(url, this.product.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Products(${this.product.id})`;
      this.ToastType = 'edit';
      this.loading = false;
      this.product.item_category_id = this.selectedCategory.id || null;
      request$ = this.commonService.put(url, this.product.toOdata(), true);
    } else if (this.isclone) {
      return (this.openCheckClone = true);
    }
    this.submitRequest(request$);
    return request$;
  }
  SubmitClone() {
    let url = '';
    let request$;
    url = 'Products';
    this.ToastType = 'add';
    const data = {
      ...this.product.toOdata(),
      item_code: this.generateCode,
      item_category_id: this.selectedCategory.id || null,
    };
    request$ = this.commonService.post(url, data, true);
    this.submitRequest(request$);
  }
  submitRequest(request$: any) {
    this.loading = true;
    this.openCheckClone = false;
    if (request$) {
      request$.subscribe({
        next: (response: any) => {
          this.mediaService.setId(response.id);
          this.product.deserialize(response);
          this.productAssociate(this.product.id, () => {
            if (this.saveMode === saveMode.POST) {
              this.inserVarianttData();
            }
            this.RefreshTable.emit();
            this.onCancel();
            this.toastService.show(this.ToastType);
          });
        },
        error: (error: any) => {
          console.error('Item Add Error', error);
          this.open = false;
          this.toastService.show('error');
        },
      });
    }
  }
  productAssociate(id: number | undefined, onSuccess?: () => void) {
    if (!id) {
      console.error('Product ID is undefined');
      this.isErrorMessage = 'Product ID is missing';
      this.loading = false;
      this.toastService.show('error');
      return;
    }

    const data = {
      product_id: id,
      category_id: this.selectedCategory.id || null,
      plants: this.Plants || [],
      suppliers: this.Suppliers || [],
      clients: this.Clients || [],
      productTypes: this.selectedProductType ? [this.selectedProductType] : [],
      itemSubCategories: this.selectedSubCategory,
    };

    this.commonService.post('product/associate', data, this.api).subscribe({
      next: (response: any) => {
        this.loading = false;
        onSuccess?.();
      },
      error: (err: any) => {
        console.error('Association error:', err);
        this.toastService.show('error');
        this.loading = false;
      },
    });
  }
  onTabSelect(event: any) {
    this.selectedTab = event.detail.tab.id;
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
    this.loadVariants();
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
        console.warn(`Unknown type: ${type}`);
        break;
      case 'uom':
        this.LoadUomList();
        console.warn(`Unknown type: ${type}`);
        break;
      case 'category':
        this.getCategory();
        console.warn(`Unknown type: ${type}`);
        break;
      case 'variant':
        this.loadVariants();
        console.warn(`Unknown type: ${type}`);
        break;
      default:
        break;
    }
  }

  AddItemCategory() {
    this.itemCategory = new ItemCategory().deserialize({});
    this.saveMode = saveMode.POST;
    this.categoryFormRef.open = true;
  }

  OnAddClickProductType() {
    this.productType = new ProductType().deserialize({});
    this.saveMode = saveMode.POST;
    this.productFormRef.open = true;
  }

  OnAddClickUom() {
    this.uom = new Uom().deserialize({});
    this.saveMode = saveMode.POST;
    this.uomFormRef.open = true;
  }
  OnAddClickSubCat() {
    this.subCatFormRef.getItemCategory();
    this.subCatFormRef.itemSubCategory = new ItemSubCategory().deserialize({});
    this.saveMode = saveMode.POST;
    this.subCatFormRef.open = true;
  }
  OnAddClickVariant() {
    this.variant = new Variant().deserialize({});
    this.saveMode = saveMode.POST;
    this.variantFormRef.open = true;
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

  // ============================= Item Variant ================================
  onVariantChange(event: any): void {
    const item = event?.detail?.item as HTMLElement | undefined;
    const text = (item as any)?.text ?? '';
    const dataId = item?.getAttribute('data-id') ?? '';

    this.variant.variant_name = text;
    this.variant.variant_id = dataId || undefined;
  }
  addVariant(): void {
    this.product.variants = [
      ...(this.product.variants ?? []),
      Object.assign(new Variant(), this.variant),
    ];
    this.Variants = [
      ...this.Variants,
      Object.assign(new Variant(), this.variant),
    ];

    this.variant = new Variant().deserialize({
      variant_currency: 'BDT',
    });
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
      this.assignVariant(this.Variants);
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
        this.assignVariant(this.Variants);
        this.toastService.show('delete');
      }
      return;
    }

    console.warn('Invalid delete operation:', data);
    this.toastService.show('error');
  }
  openVariantModal(data: any) {
    this.resetForm();
    this.isVariantEdit = false;
    this.selectedVariantId = '';
    this.openVariantEdit = true;
  }
  closeVariantModal() {
    this.resetForm();
    this.openVariantEdit = false;
  }

  Assign(): void {
    if (this.saveMode === saveMode.POST) {
      if (this.isVariantEdit) {
        const index =
          this.product.variants?.findIndex(
            (v) => v.id === Number(this.selectedVariantId),
          ) ?? -1;
        if (index > -1 && this.product.variants) {
          this.product.variants[index] = new Variant().deserialize(
            this.variant,
          );
        }
      } else {
        this.addVariant();
      }
      this.assignVariant(this.product.variants);
    } else {
      const baseProductName = this.product.product_name?.trim() || ' ';
      const baseProductID = this.product.id || 0;
      const payload: any = {
        product_name: `${baseProductName}-${this.variant.variant_value}`,
        is_active: this.product.is_active,
        is_variant: true,
        has_variant: false,
        variant_id: this.variant.variant_id,
        variant_value: this.variant.variant_value,
        is_sellable: this.product.is_sellable,
        part_number: this.product.part_number,
        model_number: this.product.model_number,
        currency: this.variant.variant_currency,
        unit_price: this.variant.variant_unit_price,
        price_in_bdt: this.variant.variant_price_in_bdt,
        price_in_usd: this.variant.variant_price_in_usd,
        description: this.product.description,
        uom_id: this.product.uom_id,
        revision: this.product.revision,
        target_cycle_time: this.product.target_cycle_time,
        parent_id: baseProductID,
        is_parent: false,
      };

      if (this.isVariantEdit && this.selectedVariantId) {
        this.commonService
          .put(`Products(${this.selectedVariantId})`, payload, this.odata)
          .subscribe({
            next: (response: any) => {
              this.toastService.show('edit');
              this.variantEditTableRef?.refreshGridData(true);
            },
            error: (err: any) => {
              console.error('Variant update error:', err);
              this.toastService.show('error');
            },
          });
      } else {
        const codePayload = {
          model: 'products',
          prefix: this.catagoryPrefix,
        };
        this.commonService
          .post(`generate-id`, codePayload, this.api)
          .subscribe({
            next: (response: any) => {
              payload.item_code = response.code;
              this.commonService
                .post(`Products`, payload, this.odata)
                .subscribe({
                  next: (insertResponse: any) => {
                    this.productAssociate(insertResponse.id);
                    this.toastService.show('add');
                    this.variantEditTableRef?.refreshGridData(true);
                  },
                  error: (err: any) => {
                    console.error('Variant insert error:', err);
                    this.toastService.show('error');
                  },
                });
            },
            error: (err: any) => {
              console.error('Item code generation error:', err);
              this.toastService.show('error');
            },
          });
      }
    }

    this.closeVariantModal();
  }

  assignVariant(data: any): void {
    this.variantDataSource = {
      ...this.variantDataSource,
      data: [...(data ?? [])],
    };
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

  async inserVarianttData(): Promise<void> {
    if (!this.validateForm()) return;

    this.loading = true;

    const productVariants = (this.product.variants ?? []).filter(
      (variant) => variant.variant_id && variant.variant_value,
    );

    try {
      const baseProductName = this.product.product_name?.trim() || ' ';
      const baseProductID = this.product.id || ' ';
      for (const variant of productVariants) {
        const codePayload = {
          model: 'products',
          prefix: this.catagoryPrefix,
        };

        const response: any = await firstValueFrom(
          this.commonService.post(`generate-id`, codePayload, this.api),
        );

        const generatedCode = response.code;
        const ItemPayload = {
          product_name: `${baseProductName}-${variant.variant_value}`,
          is_active: this.product.is_active,
          is_variant: true,
          has_variant: false,
          variant_id: variant.variant_id,
          variant_value: variant.variant_value,
          is_sellable: this.product.is_sellable,
          part_number: this.product.part_number,
          model_number: this.product.model_number,
          currency: variant.variant_currency,
          unit_price: variant.variant_unit_price,
          price_in_bdt: variant.variant_price_in_bdt,
          price_in_usd: variant.variant_price_in_usd,
          description: this.product.description,
          uom_id: this.product.uom_id,
          revision: this.product.revision,
          target_cycle_time: this.product.target_cycle_time,
          item_code: generatedCode,
          parent_id: baseProductID,
          is_parent: false,
        };

        const insertResponse: any = await firstValueFrom(
          this.commonService.post(`Products`, ItemPayload, this.odata),
        );
        const variantId = insertResponse.id;
        this.productAssociate(variantId);
      }
      this.loading = false;
      this.RefreshTable.emit();
    } catch (error: any) {
      console.error('Error inserting product variant:', error);
      this.loading = false;
      this.toastService.show('error');
    }
  }
  autoUomAdded(newUom: Uom) {
    this.Uomlists = [newUom, ...this.Uomlists];
    this.product.uom_id = newUom.id?.toString() || '';
    this.selectedItemUomName = newUom.name;
  }
  autoTypeAdded(newType: ProductType) {
    this.productTypeLists = [newType, ...this.productTypeLists];
    this.selectedProductType = new ProductType().deserialize({ newType });
    this.selectedProductType = new ProductType().deserialize({
      id: newType.id,
      name: newType.name,
    });
    this.product.productTypes = [this.selectedProductType];
    this.selectedItemTypeName = newType?.name || '';
    this.checkValidation(
      { target: { value: this.selectedProductType } },
      'itemType',
    );
  }
  autoCategoryAdded(newCat: ItemCategory) {
    this.ItemCategories = [newCat, ...this.ItemCategories];
    this.selectedCategory = new ItemCategory().deserialize({
      id: newCat.id,
      prefix: newCat.prefix,
      name: newCat.name,
    });
    this.selectedCategoryId = newCat.id || null;
    this.catagoryTitle = newCat.name;
    this.checkValidation(
      { target: { value: this.selectedCategory } },
      'category',
    );
    this.itemCodeLoad({
      model: 'products',
      prefix: newCat.prefix,
      field: 'item_code',
    });
  }
  onCancel() {
    this.closeFrom.emit();
    this.resetValuState();
    this.resetForm();
  }
  reset() {
    this.product = new Product().deserialize({});
  }
}
