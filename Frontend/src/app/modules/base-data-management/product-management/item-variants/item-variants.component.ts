import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Product } from '@shared/model/product';
import { Variant } from '@shared/model/variant';
import { Subject } from 'rxjs';
import { ItemFormComponent } from '@base-data-module/product-management/item-form/item-form.component';
import { saveMode } from '@shared/enums/saveMode';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Localization } from '@shared/utilities/localization';
import { Permissions } from '@app/shared/enums/permissions';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  AgGridCustomButton,
  GridTableColumnDataType,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';

@Component({
  selector: 'app-item-variants',
  templateUrl: './item-variants.component.html',
  styleUrl: './item-variants.component.scss',
})
export class ItemVariantsComponent implements OnInit {
  @ViewChild('itemForm') itemFormRef!: ItemFormComponent;
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<any>;

  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
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
  ToastType: string = '';
  headerTitle: string = `${$localize`Item`} ${$localize`Variants`}`;

  layoutMode: 'product' | 'split' | 'edit' = 'product';
  isEditOpen: boolean = false;
  tableData: Product[] = [];
  public saveMode: string = saveMode.POST;
  public isListCollapsed: boolean = false;
  public isTabCollapsed: boolean = true;

  private variantRefreshSubject = new Subject<number>();
  private _hasAutoSelected = false;

  public localization = Localization;

  readonly hasDeletePermission: boolean;
  selectedGridRowsId: { [key: string]: boolean } = {};

  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: 'odata',
    endpoint: 'Products',
    expand: 'suppliers,productTypes,clients,plants,variants,itemCategories,itemSubCategories($expand=subcategories)',
    filter: 'is_variant eq true',
    searchFields: ['item_code', 'product_name'],
    pageSize: 40,
    scrollPagination: true,
  };

  toolbarConfig: AgGridTableToolbarConfig = {
    showSearch: true,
    showRowCount: true,
    showScanner: true,
    showSegmentButton: false,
  };

  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: 'calc(100vh - 55px)',
  };

  customActionButtons: AgGridCustomButton[] = [];

  constructor(
    private CommonService: CommonService,
    private rolePermissionService: RolePermissionService,
    private toastService: ToastService,
  ) {
    this.odata = this.CommonService.odata;
    this.api = this.CommonService.api;
    this.hasDeletePermission = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_ITEM_VARIANTS_DELETE,
    );

    if (this.hasDeletePermission) {
      this.customActionButtons = [
        {
          id: 'print',
          icon: 'print',
          design: 'Transparent',
          tooltip: 'Print Barcode',
          onClick: (row: any) => this.printBarcode(row.id),
        },
      ];
    }
  }

  ngOnInit(): void {
    this.buildColumns();
  }

  buildColumns(): void {
    this.columns = [
      {
        field: 'is_active',
        headerName: this.localization.Active,
        dataType: GridTableColumnDataType.Boolean,
        width: 80,
        minWidth: 80,
      },
      {
        field: 'item_code',
        headerName: `${$localize`Item`} ${$localize`Code`}`,
        width: 100,
        minWidth: 100,
      },
      {
        field: 'product_name',
        headerName: `${$localize`Item`} ${$localize`Name`}`,
        flex: 1,
        minWidth: 160,
      },
      {
        field: 'model_number',
        headerName: $localize`Model`,
        minWidth: 140,
      },
      {
        field: 'part_number',
        headerName: `${$localize`Part`} ${$localize`Number`}`,
        minWidth: 140,
      },
      {
        field: 'unit_price',
        headerName: `${$localize`Unit`} ${$localize`Price`}`,
        minWidth: 140,
      },
      {
        field: 'created_at',
        headerName: this.localization.CreatedAt,
        dataType: GridTableColumnDataType.Date,
        minWidth: 140,
      },
    ];
  }

  toggleVariantView(): void {
    this.showVariant = !this.showVariant;
  }

  processData(_event?: any): void {
    this._hasAutoSelected = false;
    this.agGridRef?.refreshGridData(true);
    this.refreshTable.emit();
  }

  onGridDataLoaded(rows: any[]): void {
    if (!rows || rows.length === 0) {
      this.SelectedProduct = new Product().deserialize({ id: 0 });
      this.selectedVariant = [];
      this.tableData = [];
      return;
    }

    if (this._hasAutoSelected) return;
    this._hasAutoSelected = true;

    if (this.SelectedProduct.id && this.SelectedProduct.id !== 0) {
      const found = rows.find((r) => r.id === this.SelectedProduct.id);
      if (found) this.handleRowSelect(found);
    } else {
      this.handleRowSelect(rows[0]);
    }
  }

  handleRowSelect(data: any): void {
    if (!data) return;

    this.selectedGridRowsId = { [String(data.id)]: true };
    this.itemFormRef.selectedTab = 'selectedTab';
    this.isTabCollapsed = false;
    this.SelectedProduct = new Product().deserialize(data);
    this.itemFormRef.product = structuredClone(this.SelectedProduct);
    this.itemFormRef.saveMode = saveMode.PUT;
    this.itemFormRef.selectedProductType = data.productTypes?.[0] ?? null;
    this.itemFormRef.selectedCategory = data.itemCategories?.[0] ?? null;
    this.itemFormRef.catagoryTitle = data.itemCategories?.[0]?.name ?? '';
    this.itemFormRef.selectedSubCategory = data.itemSubCategories ?? [];
    this.itemFormRef.selectedSubCategoryIds = this.itemFormRef.selectedSubCategory.map(
      (item: any) => item.id?.toString() ?? '',
    );
    this.itemFormRef.getSubcategory(data.itemCategories?.[0]?.id ?? 0);
    this.selectedVariant = data.variants ? data.variants : [];
    this.editItem(this.SelectedProduct);
  }

  onCLickTabCollapsed(): void {
    this.isTabCollapsed = !this.isTabCollapsed;
  }

  onCLickListCollapsed(): void {
    this.isListCollapsed = !this.isListCollapsed;
  }

  cancelEdit(): void {
    this.isTabCollapsed = true;
  }

  editItem(data: any): void {
    this.product = data;
    this.itemFormRef.open = true;
    this.getAssociateData(data);
    this.saveMode = saveMode.PUT;
  }

  getAssociateData(data: any): void {
    setTimeout(() => {
      if (this.itemFormRef) {
        this.itemFormRef.Suppliers = data?.suppliers ?? [];
        this.itemFormRef.supplierDataSource = {
          ...this.itemFormRef.supplierDataSource,
          data: [...this.itemFormRef.Suppliers],
        };
        this.itemFormRef.Plants = data?.plants ?? [];
        this.itemFormRef.plantDataSource = {
          ...this.itemFormRef.plantDataSource,
          data: [...this.itemFormRef.Plants],
        };
      }

      if (this.itemFormRef) {
        const formRef = this.itemFormRef as any;
        formRef.variantDataSource = {
          ...formRef.variantDataSource,
          data: [...(data?.variants ?? [])],
        };
        formRef.Clients = data?.clients ?? [];
        formRef.clientDataSource = {
          ...formRef.clientDataSource,
          data: [...formRef.Clients],
        };
      }
    }, 200);
  }

  onDeleteClick(row: any): void {
    this.IsDelete.emit(`Products/${row.id}`);
  }

  printBarcode(productId: number): void {
    const data = { product_id: productId };
    this.CommonService.post<Blob>(
      `product-barcode`,
      data,
      this.api,
      undefined,
      'blob',
    ).subscribe({
      next: (blob: Blob) => {
        const pdfUrl = URL.createObjectURL(blob);
        const newWindow = window.open(pdfUrl, '_blank');

        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
          const link = document.createElement('a');
          link.href = pdfUrl;
          link.target = '_blank';
          link.download = `barcode_${productId}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
      },
      error: () => {
        this.ToastType = 'error';
        this.toastService.show('error');
      },
    });
  }
}
