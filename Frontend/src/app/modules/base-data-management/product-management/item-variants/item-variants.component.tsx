import {
  Component,
  EventEmitter,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { AnalyticalTableComponent } from "@shared/components/analytical-table/analytical-table.component";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { Product } from "@shared/model/product";
import { Variant } from "@shared/model/variant";
import { Button, Icon, TextAlign } from "@ui5/webcomponents-react";
import React from "react";
import { Subject } from "rxjs"
import { ItemFormComponent } from "@base-data-module/product-management/item-form/item-form.component";
import { saveMode } from "@shared/enums/saveMode";
import { ToastService } from "@app/services/toast-service/toast.service";
import { Localization } from "@shared/utilities/localization";
import { Permissions } from "@app/shared/enums/permissions";
@Component({
  selector: "app-item-variants",
  templateUrl: "./item-variants.component.html",
  styleUrl: "./item-variants.component.scss",
})
export class ItemVariantsComponent implements OnInit {
  @ViewChild("itemForm") itemFormRef!: ItemFormComponent;
  @ViewChild("productTable") productTable!: AnalyticalTableComponent;
  @Output() refreshTable: EventEmitter<void> = new EventEmitter<void>();
  @Output() IsDelete = new EventEmitter<any>();
  @Output() triggerLoading: EventEmitter<void> = new EventEmitter<void>();
  @Output() refreshVariantTableLoading: EventEmitter<void> =
    new EventEmitter<void>();
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
  headerTitle: string = `${$localize`Item`} ${$localize`Variants`}`;
  selectedRowsId: number | undefined = undefined;

  layoutMode: "product" | "split" | "edit" = "product";

  isEditOpen: boolean = false;
  tableData: Product[] = [];
  public saveMode: string = saveMode.POST;
  public isListCollapsed: boolean = false;
  public isTabCollapsed: boolean = true;

  private variantRefreshSubject = new Subject<number>();

  public localization = Localization;

  constructor(
    private CommonService: CommonService,
    private rolePermissionService: RolePermissionService,
    private toastService: ToastService
  ) {
    this.odata = this.CommonService.odata;
    this.api = this.CommonService.api;
  }
  ngOnInit(): void {
    this.tableColum();
  }
  toggleVariantView(): void {
    this.showVariant = !this.showVariant;
  }

  processData(event: any) {
    this.refreshTable.emit(event);
  }

  tableColum() {
    const columns: any[] = [
      {
        Header: this.localization.Active,
        accessor: "is_active",
        autoResizable: true,
        disableGroupBy: true,
        disableFilters: true,
        width: 80,
        className: "custom-class-name",
        Cell: ({ value }: any) =>
          value ? <Icon name="accept" /> : <Icon name="decline" />,
        isSelected: true,
      },
      {
        Header: `${$localize`Item`} ${$localize`Code`}`,
        accessor: "item_code",
        autoResizable: true,
        disableGroupBy: true,
        disableFilters: true,
        width: 100,
        className: "custom-class-name",
        isSelected: true,
      },
      {
        Header: `${$localize`Item`} ${$localize`Name`}`,
        accessor: "product_name",
        autoResizable: true,
        className: "custom-class-name",
        isSelected: true,
      },
      {
        Header: `${$localize`Model`}`,
        accessor: "model_number",
        autoResizable: true,
        className: "custom-class-name",
        isSelected: true,
      },
      {
        Header: `${$localize`Part`} ${$localize`Number`}`,
        accessor: "part_number",
        autoResizable: true,
        className: "custom-class-name",
        isSelected: true,
      },
      {
        Header: `${$localize`Unit`} ${$localize`Price`}`,
        accessor: "unit_price",
        autoResizable: true,
        className: "custom-class-name",
        isSelected: true,
      },
      {
        Header: this.localization.CreatedAt,
        accessor: "created_at",
        disableFilters: true,
        autoResizable: true,
        className: "custom-class-name",
        Cell: ({ value }: any) => new Date(value).toLocaleDateString(),
        isSelected: true,
      },
    ];

    if (this.rolePermissionService.hasPermission(Permissions.BASE_DATA_ITEM_VARIANTS_DELETE)) {
      columns.push({
        Header: this.localization.Actions,
        accessor: ".",
        cellLabel: () => "",
        disableFilters: true,
        disableGroupBy: true,
        disableSortBy: true,
        autoResizable: true,
        isSelected: true,
        id: "actions",
        width: 100,
        className: "custom-class-name",
        Cell: ({ row }: any) => (
          <div>
            <Button
              icon="delete"
              design="Transparent"
              onClick={() => {
                this.IsDelete.emit(`Products/${row.original.id}`);
              }}
            />
            <Button
              icon="print"
              design="Transparent"
              tooltip="Print Barcode"
              onClick={() => {
                this.printBarcode(row.original.id);
              }}
            />
          </div>
        ),
      });
    }

    return columns;
  }

  printBarcode(productId: number) {
    const data = { product_id: productId };
    this.CommonService.post<Blob>(
      `product-barcode`,
      data,
      this.api,
      undefined,
      "blob"
    ).subscribe({
      next: (blob: Blob) => {
        const pdfUrl = URL.createObjectURL(blob);
        const newWindow = window.open(pdfUrl, "_blank");

        if (
          !newWindow ||
          newWindow.closed ||
          typeof newWindow.closed === "undefined"
        ) {
          const link = document.createElement("a");
          link.href = pdfUrl;
          link.target = "_blank";
          link.download = `barcode_${productId}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
      },
      error: (err) => {
        console.error("Error generating barcode:", err);
        this.ToastType = "error";
        this.toastService.show("error");
      },
    });
  }

  handleRowSelect(event: any) {
    if (!event?.detail?.row?.original) return;

    if (this.productTable) {
      this.productTable.selectedRowsId = {
        [event.detail.row.index]: true,
      };
      this.selectedRowsId = event.detail.row.index;
      this.productTable.render();
    }

    this.itemFormRef.selectedTab = "selectedTab";
    const selectedData = event.detail.row.original;
    this.isTabCollapsed = false;
    this.SelectedProduct = new Product().deserialize(selectedData);
    this.itemFormRef.product = structuredClone(this.SelectedProduct);
    this.itemFormRef.saveMode = saveMode.PUT;
    this.itemFormRef.selectedProductType = selectedData.productTypes[0] ?? null;
    this.itemFormRef.selectedCategory = selectedData.itemCategories[0] ?? null;
    this.itemFormRef.catagoryTitle = selectedData.itemCategories[0]?.name ?? "";
    this.itemFormRef.selectedSubCategory = selectedData.itemSubCategories ?? [];
    this.itemFormRef.selectedSubCategoryIds =
      this.itemFormRef.selectedSubCategory.map(
        (item: any) => item.id?.toString() ?? ""
      );
    this.itemFormRef.getSubcategory(selectedData.itemCategories[0]?.id ?? 0);
    this.selectedVariant = selectedData.variants ? selectedData.variants : [];
    this.editItem(this.SelectedProduct);
  }

  handleResponseData(value: any) {
    if (!value || value.length === 0) {
      this.SelectedProduct = new Product().deserialize({ id: 0 });
      this.selectedVariant = [];
      this.tableData = [];
      return;
    }

    if (this.selectedRowsId !== undefined && this.productTable) {
      this.productTable.selectedRowsId = {
        [String(this.selectedRowsId)]: true,
      };
      const data = value[this.selectedRowsId];
      this.handleRowSelect(data);
      this.productTable.render();
    } else {
      this.productTable.selectedRowsId = { [0]: true };
      this.handleRowSelect(value[0]);
      this.selectedRowsId = 0;
      this.productTable.render();
    }
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

  editItem(data: any) {
    this.product = data;
    this.itemFormRef.open = true;
    this.getAssociateData(data);
    this.saveMode = saveMode.PUT;
  }

  getAssociateData(data: any) {
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
        this.itemFormRef.variantDataSource = {
          ...this.itemFormRef.variantDataSource,
          data: [...(data?.variants ?? [])],
        };
        this.itemFormRef.Clients = data?.clients ?? [];
        this.itemFormRef.clientDataSource = {
          ...this.itemFormRef.clientDataSource,
          data: [...this.itemFormRef.Clients],
        };
      }
    }, 200);
  }
}
