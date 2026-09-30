import {
  Component,
  EventEmitter,
  Output,
  ViewChild,
} from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { RolePermissionService } from '@app/services/role-permission-service/role-permission.service';
import { Product } from '@shared/model/product';
import { Variant } from '@shared/model/variant';
import { ItemFormComponent } from '@app/modules/base-data-management/product-management/item-form/item-form.component';
import { saveMode } from '@shared/enums/saveMode';
import { ToastService } from '@app/services/toast-service/toast.service';
import { ProductType } from '@shared/model/productType';
import { Permissions } from '@app/shared/enums/permissions';
import {
  AgGridTableComponent,
  AgGridTableCellEditEvent,
  AgGridTableRowActionEvent,
  AgGridTableToolbarActionEvent,
} from '@app/shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableFilterOptionInput,
  AgGridTableODataSourceConfig,
  AgGridTableRowAction,
  AgGridTableToolbarConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridActionCellRendererComponent } from '@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent {
  @ViewChild('agGridRef') agGridRef?: AgGridTableComponent<Product>;
  @ViewChild('itemForm') itemFormRef!: ItemFormComponent;

  @Output() refreshTable = new EventEmitter<void>();
  @Output() IsOpenToastAlert = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  @Output() triggerLoading = new EventEmitter<void>();
  @Output() refreshVariantTableLoading = new EventEmitter<void>();
  @Output() refreshVariantTable = new EventEmitter<void>();
  @Output() IsInsertVariant = new EventEmitter<any>();

  readonly permissions = Permissions;

  product = new Product();
  clone = false;
  isLoading = false;
  saveMode: string = saveMode.POST;
  isListCollapsed = false;
  isTabCollapsed = true;

  // ─── AG Grid config ───────────────────────────────────────────────────────

  gridId = 'base-data-product-list';
  private categoryOptions: AgGridTableFilterOptionInput[] = [];
  columns: AgGridTableColumn<any>[] = [];

  dataSource: AgGridTableODataSourceConfig<Product> = {
    type: 'odata',
    endpoint: 'Products',
    expand: 'suppliers,productTypes,category,clients,plants,variants,uom',
    searchFields: [
      'item_code',
      'product_name',
      'part_number',
      'model_number',
      'rack_no',
      'category.name',
    ],
    pageSize: 40,
    scrollPagination: true,
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: 'Items',
    showSearch: true,
    showScanner: true,
    showRowCount: true,
    showDownload: true,
    showSegmentButton: true,
    addButtonText: 'New',
    showNewButton: this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_ITEM_CREATE,
    ),
  };

  constructor(
    private commonService: CommonService,
    public rolePermissionService: RolePermissionService,
    private toastService: ToastService,
  ) {
    this.columns = this.buildColumns();
    this.loadCategoryOptions();
  }

  // ─── Category filter options ─────────────────────────────────────────────

  private loadCategoryOptions(): void {
    this.commonService
      .get<any>(
        'ItemCategories?$filter=is_active eq true&$select=id,name,custom_id&$orderby=name asc',
        true,
      )
      .subscribe({
        next: (res: any) => {
          this.categoryOptions = (res?.value ?? []).map((c: any) => ({
            value: c.id,
            // Dropdown label format: "custom_id - Name"
            label: [c.name, c.custom_id].filter(Boolean).join(' - '),
          }));
          this.columns = this.buildColumns();
        },
        error: () => {},
      });
  }

  // ─── Column builder ───────────────────────────────────────────────────────

  private buildColumns(): AgGridTableColumn<any>[] {
    const canEdit = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_ITEM_EDIT,
    );

    const canDelete = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_ITEM_DELETE,
    );

    const canClone = this.rolePermissionService.hasPermission(
      Permissions.BASE_DATA_ITEM_CLONE,
    );

    const rowActions: AgGridTableRowAction<any>[] = [];

    if (canClone) {
      rowActions.push({
        id: 'clone',
        label: '',
        icon: 'add-activity',
        tooltip: $localize`Clone Item`,
      });
    }

    if (canEdit) {
      rowActions.push({
        id: 'print',
        label: '',
        icon: 'print',
        tooltip: $localize`Print Barcode`,
      });
    }

    if (canDelete) {
      rowActions.push({
        id: 'delete',
        label: '',
        icon: 'delete',
        tooltip: $localize`Delete`,
        design: 'Negative',
      });
    }

    const cols: AgGridTableColumn<any>[] = [
      {
        field: 'is_active',
        headerName: $localize`Active`,
        minWidth: 80,
        width: 90,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      },
      {
        colId: 'item_category_id',
        headerName: $localize`Category`,
        minWidth: 180,
        sortable: false,
        valueGetter: (params: any) => {
          const cat = params.data?.category;
          if (!cat) return '';
          return [cat.name, cat.custom_id].filter(Boolean).join(' - ');
        },
        filterControl: {
          type: 'multiSelect',
          options: this.categoryOptions,
          placeholder: $localize`Filter categories...`,
        },
      },
      {
        field: 'item_code',
        headerName: $localize`Item Code`,
        minWidth: 120,
        ...(canEdit ? { editor: { type: 'text' as const } } : {}),
      },
      {
        field: 'product_name',
        headerName: $localize`Item Name`,
        minWidth: 180,
        ...(canEdit ? { editor: { type: 'text' as const } } : {}),
      },
      {
        field: 'model_number',
        headerName: $localize`Model`,
        minWidth: 120,
        ...(canEdit ? { editor: { type: 'text' as const } } : {}),
      },
      {
        field: 'part_number',
        headerName: $localize`Part Number`,
        minWidth: 120,
        ...(canEdit ? { editor: { type: 'text' as const } } : {}),
      },
      {
        field: 'rack_no',
        headerName: $localize`Rack No`,
        minWidth: 120,
        ...(canEdit ? { editor: { type: 'text' as const } } : {}),
      },
      {
        field: 'current_stock',
        headerName: $localize`Current Stock`,
        filter: 'agNumberColumnFilter',
        minWidth: 130,
        type: 'numericColumn',
        ...(canEdit
          ? {
              editor: {
                type: 'number' as const,
                min: 0,
                decimals: 2,
              },
            }
          : {}),
      },
      {
        field: 'minimum_stock',
        headerName: $localize`Min Stock`,
        filter: 'agNumberColumnFilter',
        minWidth: 120,
        type: 'numericColumn',
        ...(canEdit
          ? {
              editor: {
                type: 'number' as const,
                min: 0,
                decimals: 2,
              },
            }
          : {}),
      },
      {
        field: 'unit_price',
        headerName: $localize`Unit Price`,
        filter: 'agNumberColumnFilter',
        minWidth: 120,
        type: 'numericColumn',
        ...(canEdit
          ? {
              editor: {
                type: 'number' as const,
                min: 0,
                decimals: 4,
              },
            }
          : {}),
      },
      {
        field: 'created_at',
        headerName: $localize`Created On`,
        minWidth: 130,
        filter: false,
      },
    ];

    if (
      this.rolePermissionService.hasPermission(
        Permissions.BASE_DATA_ITEM_VARIANTS,
      )
    ) {
      cols.push({
        field: 'has_variant',
        headerName: $localize`Has Variant`,
        minWidth: 100,
        width: 110,
        cellRenderer: AgGridBooleanCellRendererComponent,
        filter: false,
        sortable: false,
      });
    }

    if (rowActions.length > 0) {
      cols.push({
        field: 'actions',
        headerName: $localize`Actions`,
        width: 140,
        minWidth: 140,
        pinned: 'right',
        lockPinned: true,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: rowActions,
          onAction: (actionId: string, row: any) => {
            switch (actionId) {
              case 'clone':
                this.cloneItem(row);
                break;

              case 'print':
                this.printBarcode(row.id);
                break;

              case 'delete':
                this.deleteClick(row.id);
                break;
            }
          },
        },
      });
    }

    return cols;
  }

  // ─── Grid event handlers ──────────────────────────────────────────────────

  handleRowSelect(row: Product): void {
    this.isTabCollapsed = false;
    this.editItem(row);
  }

  onCellEdited(event: AgGridTableCellEditEvent<Product>): void {
    const row = event.row as any;
    if (!row?.id) return;

    // PATCH the changed field via PUT to the OData entity endpoint
    this.commonService
      .put<any>(`Products(${row.id})`, { [event.field]: event.newValue })
      .subscribe({
        next: () => this.toastService.show('edit'),
        error: () => {
          this.toastService.show('error');
          // Reload to revert optimistic display
          this.agGridRef?.refreshGridData(true);
        },
      });
  }

  // Called by form save / delete success — reloads grid after CRUD
  processData(_event?: any): void {
    this.refreshTable.emit();
    this.reloadGrid();
  }

  private reloadGrid(): void {
    this.agGridRef?.refreshGridData(true);
  }

  // ─── Layout ───────────────────────────────────────────────────────────────

  onCLickTabCollapsed(): void {
    this.isTabCollapsed = !this.isTabCollapsed;
  }
  onCLickListCollapsed(): void {
    this.isListCollapsed = !this.isListCollapsed;
  }
  cancelEdit(): void {
    this.isTabCollapsed = true;
  }

  // ─── CRUD operations ──────────────────────────────────────────────────────

  newItem(): void {
    if (!this.itemFormRef) return;
    this.itemFormRef.isclone = false;
    this.itemFormRef.selectedTab = 'selectedTab';
    this.getAssociateData([]);
    if (this.itemFormRef.itemAttachmentsTab) {
      this.itemFormRef.itemAttachmentsTab.isEdit = false;
      this.itemFormRef.itemAttachmentsTab.isPreview = false;
    }
    this.isTabCollapsed = false;
    this.product.deserialize({});
    this.itemFormRef.resetForm();
    this.itemFormRef.reset();
    this.itemFormRef.open = true;
    this.itemFormRef.getCategory();
    this.itemFormRef.saveMode = saveMode.POST;
    this.itemFormRef.selectedSubCategory = [];
    this.itemFormRef.selectedSubCategoryIds = [];
    this.itemFormRef.catagoryTitle = '';
    this.itemFormRef.selectedProductType = new ProductType().deserialize({});
    this.itemFormRef.selectedCategory.deserialize({});
    this.saveMode = saveMode.POST;
  }

  editItem(data: any): void {
    this.product = new Product().deserialize(data);
    this.itemFormRef.isclone = false;
    this.itemFormRef.open = true;
    this.itemFormRef.selectedItemTypeName = data.productTypes?.[0]?.name ?? '';
    this.itemFormRef.selectedItemUomName = data.uom?.name ?? '';
    if (this.itemFormRef.itemAttachmentsTab) {
      this.itemFormRef.itemAttachmentsTab.isEdit = true;
      this.itemFormRef.itemAttachmentsTab.isPreview = true;
    }
    setTimeout(() =>
      this.itemFormRef.variantEditTableRef?.refreshGridData(true),
    );
    this.getAssociateData(data);

    this.itemFormRef.selectedTab = 'selectedTab';
    this.itemFormRef.product = new Product().deserialize(data);
    this.itemFormRef.saveMode = saveMode.PUT;
    this.itemFormRef.resetValuState();
    this.itemFormRef.selectedProductType = data.productTypes?.[0] ?? null;
    this.itemFormRef.selectedCategory = data.category ?? null;
    this.itemFormRef.catagoryTitle = data.category?.name ?? '';
    this.itemFormRef.selectedSubCategory = data.itemSubCategories ?? [];
    this.itemFormRef.selectedSubCategoryIds =
      this.itemFormRef.selectedSubCategory.map(
        (item: any) => item.id?.toString() ?? '',
      );
    this.saveMode = saveMode.PUT;
  }

  cloneItem(data: any): void {
    this.itemFormRef.isclone = true;
    this.clone = true;
    this.product = new Product().deserialize(data);
    this.itemFormRef.selectedItemTypeName = data.productTypes?.[0]?.name ?? '';
    this.itemFormRef.selectedItemUomName = data.uom?.name ?? '';
    if (this.itemFormRef.itemAttachmentsTab) {
      this.itemFormRef.itemAttachmentsTab.isEdit = true;
      this.itemFormRef.itemAttachmentsTab.isPreview = true;
    }
    setTimeout(() => {
      this.itemFormRef.variantEditTableRef?.refreshGridData(true);
      if (data.category) {
        this.itemFormRef.selectedCategory = data.category;
        this.itemFormRef.catagoryTitle = data.category.name;
        this.itemFormRef.itemCodeLoad({
          model: 'products',
          prefix: data.category.prefix ?? '',
          field: 'item_code',
        });
      }
    }, 200);
    this.getAssociateData(data);
    this.saveMode = saveMode.POST;
    this.isTabCollapsed = false;
    this.itemFormRef.open = true;
  }

  deleteClick(id: any): void {
    this.IsDelete.emit(`Products/${id}`);
  }

  printBarcode(productId: number): void {
    this.commonService
      .post<Blob>(
        'product-barcode',
        { product_id: productId },
        false,
        undefined,
        'blob',
      )
      .subscribe({
        next: (blob: Blob) => {
          const pdfUrl = URL.createObjectURL(blob);
          const win = window.open(pdfUrl, '_blank');
          if (!win || win.closed || typeof win.closed === 'undefined') {
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
        error: () => this.toastService.show('error'),
      });
  }

  downloadData(): void {
    this.isLoading = true;
    this.commonService
      .post<Blob>('item/export', {}, false, undefined, 'blob')
      .subscribe({
        next: (res: Blob) => {
          const url = window.URL.createObjectURL(res);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'Exported Items.xlsx';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          window.URL.revokeObjectURL(url);
          this.toastService.show('export');
          this.isLoading = false;
        },
        error: () => {
          this.isLoading = false;
          this.toastService.show('error');
        },
      });
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
        this.itemFormRef.Clients = data?.clients ?? [];
        this.itemFormRef.clientDataSource = {
          ...this.itemFormRef.clientDataSource,
          data: [...this.itemFormRef.Clients],
        };
      }
    }, 200);
  }

  // Kept for variant compatibility
  variantData: Variant[] = [];
}
