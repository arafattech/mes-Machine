import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  ViewChild,
} from "@angular/core";

import { CommonService } from "@app/services/common-service/common.service";
import { MediaService } from "@app/services/media-service.js";
import { ProductFormComponent } from "@base-data-module/product-management/product-type/product-form/product-form.component";
import { UomFormComponent } from "@base-data-module/product-management/uom/uom-form/uom-form.component";
import { AssosiateComponent } from "@shared/components/assosiate/assosiate.component";
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
import moment from "moment";
import { PricePlan } from "@app/modules/sales-management/shared/model/price-plan";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { AgGridBooleanCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component";
import { CalendarComponent } from "@app/shared/components/calender/calender.component";
import { Permissions } from "@app/shared/enums/permissions";
@Component({
  selector: "app-pricing-form",
  templateUrl: "./pricing-form.component.html",
  styleUrl: "./pricing-form.component.scss",
})
export class PricingFormComponent implements OnChanges {
  @ViewChild("productForm") productFormRef!: ProductFormComponent;
  @ViewChild("pricePlanAgGridRef") pricePlanAgGridRef?: AgGridTableComponent;
  @ViewChild("calendarComponent") calendar!: CalendarComponent;
  @Input() saveMode: string = saveMode.POST;
  @Input() isVariantList: boolean = false;
  @Input() isclone: boolean = false;
  @Output() closeFrom = new EventEmitter<void>();
  @Input() product: Product = new Product();
  @Output() RefreshTable = new EventEmitter<any>();
  @Output() refreshTrigger: EventEmitter<any> = new EventEmitter<any>();
  @Output() IsDelete = new EventEmitter<any>();
  disabledDateRanges: any[] = [];
  productType: ProductType = new ProductType().deserialize({});
  pricePlan: PricePlan = new PricePlan().deserialize({});
  itemCategory: ItemCategory = new ItemCategory().deserialize({});
  uom: Uom = new Uom();
  variant: Variant = new Variant().deserialize({});
  column: any;
  selectedVariantType: string = "";
  loading: boolean = false;
  public permissions = Permissions
  openPlan: boolean = false;
  odata: boolean;
  api: boolean;
  Permission?: string = "";
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
  resId: string = "";
  isAddError: boolean = false;
  ItemSubCategories: ItemSubCategory[] = [];
  categoryValidationMessages: string[] = [];
  selectedCategoryId: number | null = null;
  isErrorMessage: string = "";
  IsSupplier: boolean = false;
  variantLists: Variant[] = [];
  Variants: Variant[] = [];
  variantIds: string[] = [];
  Variant = new Variant().deserialize({});
  IsAssosiate: boolean = false;
  open: boolean = false;
  openCheckClone: boolean = false;
  checkCloneValidate: boolean = false;
  selectedTab = "coreData";
  isAddDialogOpen: boolean = false;
  showUomSection: boolean = false;
  showVariantSection: boolean = false;
  Uomlists: Uom[] = [];
  openVariant: boolean = false;
  isAddProductTypeDialogOpen: boolean = false;
  productTypeLists: ProductType[] = [];
  buttonText: string = "Add More";
  buttonIcon: string = "add";
  catagoryPrefix: string = "";
  catagoryTitle: string = "";
  selectedCategory: ItemCategory = new ItemCategory();
  selectedSubCategory: ItemSubCategory[] = [];
  selectedProductType: ProductType | null = null;
  selectedSubCategoryIds: string[] = [];
  isVariantEdit: boolean = false;
  selectedVariantId: string = "";
  isVariantTabOpen: boolean;
  showAddMore: boolean = false;
  className: string = "hidden";
  selectedProductTypeId: string | null = null;
  newlyAddedUom: Uom | null = null;
  newlyAddedProductType: ProductType | null = null;
  isNewProductTypeAdded: boolean = false;
  openVariantEdit: boolean = false;
  ToastType: "add" | "edit" | "error" = "add";
  selectedItemTypeName: string = "";
  selectedItemUomName: string = "";
  supplierTableTitle: string = `${$localize`Supplier`} ${$localize`List`}`;
  clientTableTitle: string = `${$localize`Client`} ${$localize`List`}`;
  plantTableTitle: string = `${$localize`Plant`} ${$localize`List`}`;
  variantTableTitle: string = `${$localize`Variant`} ${$localize`List`}`;
  public validationMessage = Localization.requiredField;
  public validationDate = "";
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  public currency = currency;

  // ─── AG Grid config ───────────────────────────────────────────────────────

  planColumns: AgGridTableColumn<PricePlan>[] = [];
  planDataSource: AgGridTableODataSourceConfig<PricePlan> = {
    type: "odata",
    endpoint: "ItemPricePlannings",
    filter: "product_id eq 0",
    sortDirection: "desc",
  };
  planToolbarConfig!: AgGridTableToolbarConfig;
  planDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 300px)",
  };
  start = moment().subtract(90, "days").format("YYYY-MM-DD");
  end = moment().add(0, "days").format("YYYY-MM-DD");
  momentInstance = moment;
  currentDate = moment().format("DD-MM-YYYY");
  dateRangeValue: string = "";
  generateCode: string = "";
  valueStateOptions = {
    name: ValueState.None,
    code: ValueState.None,
    catagory: ValueState.None,
    unit_price: ValueState.None,
    uom: ValueState.None,
    itemType: ValueState.None,
  };

  pricingPlanValueState = {
    range: ValueState.None,
    price: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private mediaService: MediaService,
    private cdRef: ChangeDetectorRef,
    public rolePermissionService: RolePermissionService
  ) {
    this.odata = this.commonService.odata;
    this.api = this.commonService.api;
    this.isVariantTabOpen = false;
    this.disabledDateRanges = [];
    this.planColumns = this.buildPlanColumns();
    this.planToolbarConfig = {
      headerTitle: $localize`Pricing Plans`,
      showSearch: true,
      showRowCount: true,
      showNewButton: this.rolePermissionService.hasPermission(
        Permissions.SALES_PRICING_PLAN_CREATE
      ),
      addButtonText: $localize`New`,
      showDownload: false,
      showTableSettingBtn: false,
    };
  }

  public hasPermission(permission: string): boolean {
    return this.rolePermissionService.hasPermission(permission);
  }

  ngOnInit(): void {
    this.getBatchData();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes["product"]?.currentValue?.id) {
      this.planDataSource = {
        type: "odata",
        endpoint: "ItemPricePlannings",
        filter: `product_id eq ${changes["product"].currentValue.id}`,
        sortDirection: "desc",
      };
    }
  }

  private buildPlanColumns(): AgGridTableColumn<PricePlan>[] {
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
        field: "plan_name",
        headerName: $localize`Plan Name`,
        flex: 1,
        minWidth: 150,
      },
      {
        field: "start_date",
        headerName: $localize`Start Date`,
        minWidth: 130,
      },
      {
        field: "end_date",
        headerName: $localize`End Date`,
        minWidth: 130,
      },
      {
        field: "price",
        headerName: $localize`Unit Price`,
        minWidth: 110,
      },
    ];
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

  resetPricingPlanValueState() {
    this.pricingPlanValueState = {
      range: ValueState.None,
      price: ValueState.None,
    };
  }

  getCategory() {
    this.commonService
      .get(
        `ItemCategories?$orderby=id desc&$filter=is_active eq true`,
        this.odata
      )
      .subscribe({
        next: (response: any) => {
          this.ItemCategories = response.value.map((item: any) =>
            new ItemCategory().deserialize(item)
          );
        },
        error: (err) => {
          console.error(err);
        },
      });
  }

  loadVariants() {
    this.commonService
      .get("Variants?$orderby=id desc&$filter=is_active eq true", this.odata)
      .subscribe({
        next: (response: any) => {
          this.variantLists = (response?.value ?? [])
            .map((item: any) => new Variant().deserialize(item))
            .map((v: any) => ({
              ...v,
              name: (v?.name ?? "").toString(),
              id: (v?.id ?? "").toString(),
            }))
            .filter((v: any) => v.name.length > 0);
          this.cdRef.detectChanges();
        },
        error: (err) => console.error(err),
      });
  }

  loadProductTypes() {
    this.commonService
      .get("ProductTypes?$orderby=id desc&$filter=is_active eq true")
      .subscribe({
        next: (res: any) => {
          this.productTypeLists =
            res.value?.map((item: any) =>
              new ProductType().deserialize(item)
            ) || [];
        },
        error: (err) => console.error(err),
      });
  }

  LoadUomList() {
    this.commonService
      .get("Uoms?$orderby=id desc&$filter=is_active eq true", this.odata)
      .subscribe({
        next: (response: any) => {
          this.Uomlists = response.value
            .filter((item: any) => item.id && item.name)
            .map((item: any) => new Uom().deserialize(item));
          if (this.product.uom_id) {
            const matchedUom = this.Uomlists.find(
              (u) => u.id?.toString() === this.product.uom_id?.toString()
            );
            if (matchedUom) {
              this.selectedItemUomName = matchedUom.name;
            }
          }
          if (this.newlyAddedUom) {
            this.Uomlists = [this.newlyAddedUom, ...this.Uomlists];
            this.product.uom_id = this.newlyAddedUom.id?.toString() || "";
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
          id: "1",
          method: "GET",
          url: "/odata/ItemCategories?$orderby=id desc&$filter=is_active eq true",
        },
        {
          id: "2",
          method: "GET",
          url: "/odata/Variants?$orderby=id desc&$filter=is_active eq true",
        },
        {
          id: "3",
          method: "GET",
          url: "/odata/ProductTypes?$orderby=id desc&$filter=is_active eq true",
        },
        {
          id: "4",
          method: "GET",
          url: "/odata/Uoms?$orderby=id desc&$filter=is_active eq true",
        },
      ],
    };

    this.commonService.post("$batch", batchPayload, this.odata).subscribe({
      next: (res: any) => {
        const responses = res.responses;

        const itemCategoriesRes = responses.find((r: any) => r.id === "1");
        const variantsRes = responses.find((r: any) => r.id === "2");
        const productTypesRes = responses.find((r: any) => r.id === "3");
        const uomsRes = responses.find((r: any) => r.id === "4");

        if (itemCategoriesRes?.body?.value) {
          this.ItemCategories = itemCategoriesRes.body.value.map((item: any) =>
            new ItemCategory().deserialize(item)
          );
        }

        if (variantsRes?.body?.value) {
          this.variantLists = variantsRes.body.value.map((item: any) =>
            new Variant().deserialize(item)
          );
        }

        if (productTypesRes?.body?.value) {
          this.productTypeLists = productTypesRes.body.value.map((item: any) =>
            new ProductType().deserialize(item)
          );
        }

        if (uomsRes?.body?.value) {
          this.Uomlists = uomsRes.body.value
            .filter((item: any) => item.id && item.name)
            .map((item: any) => new Uom().deserialize(item));

          if (this.newlyAddedUom) {
            this.Uomlists = [this.newlyAddedUom, ...this.Uomlists];
            this.product.uom_id = this.newlyAddedUom.id?.toString() || "";
            this.newlyAddedUom = null;
          }
        }

        this.cdRef.detectChanges();
      },
      error: (err) => {
        console.error("Batch request failed", err);
      },
    });
  }
  // ===================================  Category ===================================
  onCategorySelection(event: any) {
    const rawId = event.detail.item?.id;
    const selectedId =
      rawId !== null && rawId !== undefined ? Number(rawId) : undefined;

    this.catagoryPrefix = event.detail.item?.value ?? "";
    this.catagoryTitle = event.detail.item?.text ?? "";
    this.selectedCategory = new ItemCategory().deserialize({
      id: selectedId,
      prefix: this.catagoryPrefix,
      name: this.catagoryTitle,
    });
    this.product.item_category_id = selectedId || null;
    this.itemCodeLoad({
      model: "products",
      prefix: this.catagoryPrefix,
      field: "item_code",
    });
    this.checkValidation({ target: { value: selectedId } }, "category");
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
            new ItemSubCategory().deserialize(item)
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
        this.checkValidation({ target: { value: response.code } }, "code");
        this.checkValidation({ target: { value: response.code } }, "code");
        this.cdRef.detectChanges();
      },
      error: (error: any) => {
        console.error("Error Generating Item Code:", error);
      },
    });
  }

  associateTableColum() {
    const columns = [
      {
        accessor: "custom_id",
      },
      {
        accessor: "name",
      },
    ];
    return columns;
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

    return isValid;
  }
  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";
    switch (field) {
      case "name":
        if (!value.trim()) {
          this.valueStateOptions.name = ValueState.Negative;
        } else {
          this.product.product_name = value;
          this.valueStateOptions.name = ValueState.None;
        }
        break;

      case "price":
        if (!value.trim()) {
          this.pricingPlanValueState.price = ValueState.Negative;
        } else {
          this.pricingPlanValueState.price = ValueState.None;
        }
        break;

      case "code":
        if (!this.product.item_code?.trim() && !this.generateCode?.trim()) {
          this.valueStateOptions.code = ValueState.Negative;
        } else {
          this.product.item_code = value;
          this.generateCode = value;
          this.valueStateOptions.code = ValueState.None;
        }
        break;

      case "category":
        if (!this.selectedCategory.id) {
          this.valueStateOptions.catagory = ValueState.Negative;
        } else {
          this.product.itemCategories = [this.selectedCategory];
          this.valueStateOptions.catagory = ValueState.None;
        }
        break;
      case "unit_price":
        if (!value.trim()) {
          this.valueStateOptions.unit_price = ValueState.Negative;
        } else {
          this.product.unit_price = value;
          this.valueStateOptions.unit_price = ValueState.None;
        }
        break;

      case "itemType":
        if ((this.product.productTypes ?? []).length > 0) {
          this.valueStateOptions.itemType = ValueState.None;
        } else {
          this.valueStateOptions.itemType = ValueState.Negative;
        }
        break;

      case "Item_uom":
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
    if (!code) return "";
    const parts = code.split("-");
    if (parts.length <= 1) return code;
    parts.shift();
    return parts.join("-");
  }

  onSaveType() {
    if (!this.validateForm()) {
      this.selectedTab = "coreData";
      return;
    }
    if (this.product.has_variant) {
      this.product.is_variant = false;
    } else {
      this.product.is_variant = true;
    }
    let url = "";
    let request$;

    if (this.saveMode === saveMode.POST && !this.isclone) {
      url = "Products";
      this.ToastType = "add";
      this.product.item_category_id = this.selectedCategory.id || null;
      this.loading = false;
      request$ = this.commonService.post(url, this.product.toOdata(), true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `Products(${this.product.id})`;
      this.ToastType = "edit";
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
    let url = "";
    let request$;
    url = "Products";
    this.ToastType = "add";
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
          this.productAssociate(this.product.id);
          if (this.saveMode === saveMode.POST) {
            this.inserVarianttData();
          }
          this.RefreshTable.emit();
          this.onCancel();
          this.toastService.show(this.ToastType);
        },
        error: (error: any) => {
          console.error("Item Add Error", error);
          this.open = false;
          this.toastService.show("error");
        },
      });
    }
  }
  productAssociate(id: number | undefined) {
    if (!id) {
      console.error("Product ID is undefined");
      this.isErrorMessage = "Product ID is missing";
      this.loading = false;
      this.toastService.show("error");
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

    this.commonService.post("product/associate", data, this.api).subscribe({
      next: (response: any) => {
        this.loading = false;
      },
      error: (err: any) => {
        console.error("Association error:", err);
        this.toastService.show("error");
        this.loading = false;
      },
    });
  }
  onTabSelect(event: any) {
    this.selectedTab = event.detail.tab.id;
    this.selectedTab = event.detail.tab.id;
  }
  onUomSelectFocus($event?: any) {
    if ($event) {
      const item = $event.detail.item;
      if (item) {
        this.product.uom_id = item.id?.toString() || "";
        this.selectedItemUomName = item.text || "";
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
      this.selectedItemTypeName = "";
    } else {
      this.selectedProductType = new ProductType().deserialize({
        id: item.id,
        name: item.text,
      });
      this.selectedItemTypeName = item.text || "";
      this.product.productTypes = [this.selectedProductType];
    }
  }
  onRefreshTable(type: string) {
    switch (type) {
      case "item_type":
        this.loadProductTypes();
        console.warn(`Unknown type: ${type}`);
        break;
      case "uom":
        this.LoadUomList();
        console.warn(`Unknown type: ${type}`);
        break;
      case "category":
        this.getCategory();
        console.warn(`Unknown type: ${type}`);
        break;
      case "variant":
        this.loadVariants();
        console.warn(`Unknown type: ${type}`);
        break;
      default:
        break;
    }
  }

  OnAddClickProductType() {
    this.productType = new ProductType().deserialize({});
    this.saveMode = saveMode.POST;
    this.productFormRef.open = true;
  }

  onCurrencyChange($event: any) {
    const currency = $event.detail.item?.text;
    this.product.currency = currency;
    this.calculateAmount();
    this.cdRef.detectChanges();
  }

  calculateAmount() {
    const rate = parseFloat((this.product.price_in_bdt as string) || "0");
    const value = parseFloat((this.product.price_in_usd as string) || "0");

    if (!isNaN(rate) && !isNaN(value)) {
      this.product.unit_price = (rate * value).toString();
    } else {
    }
  }

  // ============================= Item Variant ================================
  onVariantChange(event: any): void {
    const item = event?.detail?.item as HTMLElement | undefined;
    const text = (item as any)?.text ?? "";
    const dataId = item?.getAttribute("data-id") ?? "";

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
      variant_currency: "BDT",
    });
  }

  onVariantCurrencyChange(event: any): void {
    const currency = event.detail.item?.text;
    this.variant.variant_currency = currency;
    if (currency !== currency.BDT) {
      this.variant.variant_price_in_bdt = "";
      this.variant.variant_price_in_usd = "";
      this.variant.variant_unit_price = "";
    }
  }

  calculateVariantUsdAmount(): void {
    const rate = parseFloat(this.variant.variant_price_in_bdt || "0") || 0;
    const usdValue = parseFloat(this.variant.variant_price_in_usd || "0") || 0;
    if (rate && usdValue) {
      this.variant.variant_unit_price = (rate * usdValue).toString();
    } else {
      this.variant.variant_unit_price = "";
    }
  }
  removeVariant(data: any): void {
    if (this.saveMode === saveMode.POST) {
      this.product.variants =
        this.product?.variants?.filter((v) => v !== data) ?? [];
      this.Variants = [...this.product.variants];

      this.toastService.show("delete");
      return;
    }

    if (this.saveMode === saveMode.PUT) {
      if (data?.id) {
        this.IsDelete.emit(`Products/${data.id}`);
      } else {
        this.product.variants =
          this.product?.variants?.filter((v) => v !== data) ?? [];
        this.Variants = [...this.product.variants];

        this.toastService.show("delete");
      }
      return;
    }

    console.warn("Invalid delete operation:", data);
    this.toastService.show("error");
  }
  openVariantModal(data: any) {
    this.resetForm();
    this.isVariantEdit = false;
    this.selectedVariantId = "";
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
            (v) => v.id === Number(this.selectedVariantId)
          ) ?? -1;
        if (index > -1 && this.product.variants) {
          this.product.variants[index] = new Variant().deserialize(
            this.variant
          );
        }
      } else {
        this.addVariant();
      }
    } else {
      const baseProductName = this.product.product_name?.trim() || " ";
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
              this.toastService.show("edit");
            },
            error: (err: any) => {
              console.error("Variant update error:", err);
              this.toastService.show("error");
            },
          });
      } else {
        const codePayload = {
          model: "products",
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
                    this.toastService.show("add");
                  },
                  error: (err: any) => {
                    console.error("Variant insert error:", err);
                    this.toastService.show("error");
                  },
                });
            },
            error: (err: any) => {
              console.error("Item code generation error:", err);
              this.toastService.show("error");
            },
          });
      }
    }

    this.closeVariantModal();
  }

  public resetForm(): void {
    this.variant = new Variant().deserialize({
      variant_currency: "BDT",
      variant_value: "",
    });
    this.selectedVariantType = "";
    this.selectedItemUomName = "";
    this.selectedItemTypeName = "";
  }

  async inserVarianttData(): Promise<void> {
    if (!this.validateForm()) return;

    this.loading = true;

    const productVariants = (this.product.variants ?? []).filter(
      (variant) => variant.variant_id && variant.variant_value
    );

    try {
      const baseProductName = this.product.product_name?.trim() || " ";
      const baseProductID = this.product.id || " ";
      for (const variant of productVariants) {
        const codePayload = {
          model: "products",
          prefix: this.catagoryPrefix,
        };

        const response: any = await firstValueFrom(
          this.commonService.post(`generate-id`, codePayload, this.api)
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
          this.commonService.post(`Products`, ItemPayload, this.odata)
        );
        const variantId = insertResponse.id;
        this.productAssociate(variantId);
      }
      this.loading = false;
      this.RefreshTable.emit();
    } catch (error: any) {
      console.error("Error inserting product variant:", error);
      this.loading = false;
      this.toastService.show("error");
    }
  }
  autoUomAdded(newUom: Uom) {
    this.Uomlists = [newUom, ...this.Uomlists];
    this.product.uom_id = newUom.id?.toString() || "";
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
    this.selectedItemTypeName = newType?.name || "";
    this.checkValidation(
      { target: { value: this.selectedProductType } },
      "itemType"
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
      "category"
    );
    this.itemCodeLoad({
      model: "products",
      prefix: newCat.prefix,
      field: "item_code",
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

  private toApiDate(raw?: string): string {
    if (!raw) return "";

    const [d, m, y] = raw.split("/");
    const iso = `${y}-${m}-${d}`;
    return isNaN(new Date(iso).getTime()) ? "" : iso;
  }
  dateRangePickerChange(event: any) {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    if (!value) {
      this.pricePlan.start_date = "";
      this.pricePlan.end_date = "";
      this.dateRangeValue = "";
      this.pricingPlanValueState.range = ValueState.Negative;
      this.validationDate = Localization.requiredField;
      return;
    } else {
      this.pricingPlanValueState.range = ValueState.None;
    }

    const [startStr, endStr] = value.split(" - ");
    const start = moment(startStr, "YYYY-MM-DD");
    const end = moment(endStr, "YYYY-MM-DD");

    this.pricePlan.start_date = start.format("YYYY-MM-DD");
    this.pricePlan.end_date = end.format("YYYY-MM-DD");
    this.dateRangeValue = value;

    if (!this.pricePlan.end_date || this.pricePlan.end_date == "Invalid date") {
      this.pricingPlanValueState.range = ValueState.Negative;
      this.validationDate = Localization.invalidDateFormat;
    }

    if (this.pricePlan.start_date && this.pricePlan.end_date) {
      this.checkValidation(
        { target: { value: this.pricePlan.start_date } },
        "startDate"
      );
      this.checkValidation(
        { target: { value: this.pricePlan.end_date } },
        "endDate"
      );
    }
  }

  newPlan() {
    this.saveMode = saveMode.POST;
    this.openPlan = true;
    this.pricePlan = new PricePlan().deserialize({});
    this.dateRangeValue = "";
  }
  editPlan(data: any) {
    this.saveMode = saveMode.PUT;
    this.openPlan = true;
    this.pricePlan = structuredClone(data);
    this.pricePlan.plan_name = data.plan_name || "";
    this.pricePlan.start_date = moment(data.start_date).format("YYYY-MM-DD");
    this.pricePlan.end_date = moment(data.end_date).format("YYYY-MM-DD");
    this.dateRangeValue =
      this.pricePlan.start_date && this.pricePlan.end_date
        ? `${moment(this.pricePlan.start_date).format("YYYY-MM-DD")} - ${moment(
            this.pricePlan.end_date
          ).format("YYYY-MM-DD")}`
        : "";
  }

  getDatesBetween(start: string, end: string): string[] {
    const dates: string[] = [];
    let current = new Date(start);
    const endDate = new Date(end);

    while (current <= endDate) {
      // Format into YYYY-MM-DD (UI5 Calendar required format)
      const formatted = current.toISOString().split("T")[0];
      dates.push(formatted);
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  checkPricePlanValid() {
    const { start_date, end_date, price } = this.pricePlan;

    if (!start_date || !end_date) {
      this.validationDate = Localization.requiredField;
      this.pricingPlanValueState.range = ValueState.Negative;
    } else if (end_date === "Invalid date") {
      this.validationDate = Localization.invalidDateFormat;
      this.pricingPlanValueState.range = ValueState.Negative;
    } else {
      this.validationDate = "";
      this.pricingPlanValueState.range = ValueState.None;
    }

    this.pricingPlanValueState.price = !price
      ? ValueState.Negative
      : ValueState.None;

    return (
      this.pricingPlanValueState.range !== ValueState.Negative &&
      this.pricingPlanValueState.price !== ValueState.Negative
    );
  }

  savePlan() {
    if (!this.product?.id) {
      this.toastService.show("error");
      return;
    }

    if (!this.checkPricePlanValid()) {
      return;
    }

    this.loading = true;
    const payload: any = {
      ...this.pricePlan,
      product_id: Number(this.product.id),
      plan_name: (this.pricePlan.plan_name || "").trim() || null,
      price: this.pricePlan.price
        ? parseFloat(this.pricePlan.price as any)
        : null,
      start_date: moment(this.pricePlan.start_date).format("YYYY-MM-DD"),
      end_date: moment(this.pricePlan.end_date).format("YYYY-MM-DD"),
    };
    let url = "";

    let request$;

    if (this.saveMode === saveMode.POST) {
      url = "ItemPricePlannings";
      this.ToastType = "add";
      request$ = this.commonService.post(url, payload, true);
    } else if (this.saveMode === saveMode.PUT) {
      url = `ItemPricePlannings(${this.pricePlan.id})`;
      this.ToastType = "edit";
      request$ = this.commonService.put(url, payload, true);
    }

    request$?.subscribe({
      next: (res) => {
        this.refreshPricePlanTable();
        this.ClosePlan();
        this.loading = false;
        this.toastService.show(this.ToastType);
      },
      error: (error: any) => {
        console.error("Price Plan Save Error", error);
        this.loading = false;
        this.toastService.show("error");
      },
    });
  }
  deletePlan(event: any) {
    const data = event.id;
    this.IsDelete.emit(`ItemPricePlannings/${data}`);
  }

  processData(event: any) {}

  generateDateRange(start: string, end: string): string[] {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const dates: string[] = [];

    while (startDate <= endDate) {
      dates.push(startDate.toISOString().split("T")[0]);
      startDate.setDate(startDate.getDate() + 1); // Move forward
    }

    return dates;
  }

  refreshPricePlanTable() {
    this.pricePlanAgGridRef?.refreshGridData(true);
  }
  ClosePlan() {
    this.openPlan = false;
    this.resetPricingPlanValueState();
    this.pricePlan.plan_name = "";
    this.pricePlan.start_date = "";
    this.pricePlan.end_date = "";
    this.pricePlan.price = "";
  }
}
