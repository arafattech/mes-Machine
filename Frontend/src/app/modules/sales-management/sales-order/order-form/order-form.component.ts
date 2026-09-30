import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";
import { AuthService } from "@app/services/auth-service/auth.service";
import { CommonService } from "@app/services/common-service/common.service";
import { MediaService } from "@app/services/media-service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { SocketService } from "@app/services/socket.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { AssosiateComponent } from "@app/shared/components/assosiate/assosiate.component";
import { ClientFormComponent } from "@app/modules/base-data-management/client-management/client-form/client-form.component";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridActionCellRendererComponent, AgGridQtyStepperCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableRowAction,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { saveMode } from "@app/shared/enums/saveMode";
import { Client } from "@app/shared/model/client";
import { Department } from "@app/shared/model/department";
import { Product } from "@app/shared/model/product";
import { User } from "@app/shared/model/user";
import { Localization } from "@app/shared/utilities/localization";
import ValueState from "@ui5/webcomponents-base/dist/types/ValueState.js";
import { SalesOrder } from "@sales-module/shared/model/sales-order";
import {
  DiscountOption,
  DiscountType,
  SalesStatus,
} from "@sales-module/shared/enums/sales-status";

import moment from "moment";

import "@ui5/webcomponents-fiori/dist/Wizard.js";
import "@ui5/webcomponents-fiori/dist/WizardStep.js";

@Component({
  selector: "app-order-form",
  templateUrl: "./order-form.component.html",
  styleUrl: "./order-form.component.scss",
})
export class OrderFormComponent implements OnInit {
  @Input() showNewButton: boolean = true;
  @ViewChild("childComponentRef") childComponentRef!: AgGridTableComponent;
  @ViewChild("clientForm") clientFormRef!: ClientFormComponent;
  @ViewChild("itemAssosiate") itemAssosiate!: AssosiateComponent;
  @ViewChild("deliveryDatePicker") deliveryDatePicker: any;
  @ViewChild("clientNameCombo") clientNameCombo: any;
  @Input() saveMode = "POST";
  @Input() selectedData: any;
  @Input() requisitionType = "PI";
  @Output() saveEvent = new EventEmitter<any>();
  @Input() isV8: boolean = false;
   client: Client = new Client().deserialize({});
  open: boolean = false;
  loading: boolean = false;
  dateRangeValue: string = "";
  clientName: string = "";
  departmentName: string = "";
  statusTitle: string = "";
  status: string = "";
  warningMessage: string = "";
  validationDate: string = "";
  sprType: any;
  column: AgGridTableColumn<any>[] = [];
  pricePlannings: any = {};
  salesValidationWarning: any = {};

  dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };
  toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Items to Sale`,
    showSearch: true,
    showRowCount: true,
    showDownload: false,
    showSegmentButton: false,
    addButtonText: $localize`Associate`,
    showNewButton: true,
  };
  displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 580px)",
    fillEmptyRows: true,
  };

  public isDisabled: boolean = false;
  public isReadOnly: boolean = false;
  public isStatusReadOnly: boolean = true;
  public isWarning: boolean = false;
  public isWarningValidation: boolean = false;

  public authUser: User = new User();
  public product = Product;
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  public responseType: saveMode = saveMode.POST;
  public stockTitle = Localization.currentStock;
  public SalesOrder = new SalesOrder().deserialize({});
  public selectedItem: any[] = [];
  public departments: Department[] = [];
  public clientList: Client[] = [];

  ToastType: "add" | "edit" | "error" = "add";
  DiscountType = Object.values(DiscountType);
  DiscountOption = Object.values(DiscountOption);
  SalesStatus = Object.values(SalesStatus);

  DiscountConfig = {
    Options: this.DiscountOption[0],
    Type: this.DiscountType[0],
  };

  valueStateOptions = {
    client_id: ValueState.None,
    expected_delivery_date: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private mediaService: MediaService,
    private cdRef: ChangeDetectorRef,
    public rolePermissionService: RolePermissionService,
    private socketService: SocketService,
    private authService: AuthService
  ) {
    this.cilentList();
    this.tableColum();
    this.authUser = this.authService.user();
  }

  ngOnInit(): void {
    this.initPricePlannings();
  }

  currentStep = 1;

  goToStep(step: number): void {
    if (step < 1 || step > 2) return;
    this.currentStep = step;
  }

  nextStep(): void {
    this.goToStep(this.currentStep + 1);
  }

  prevStep(): void {
    this.goToStep(this.currentStep - 1);
  }

  onWizardStepChange(event: any): void {
    const index = Number(event?.detail?.step?.dataset?.step);
    if (!Number.isNaN(index) && index >= 1) {
      this.currentStep = index;
    }
  }

  CloseDialog() {
    this.open = false;
    this.currentStep = 1;
    this.SalesOrder = new SalesOrder().deserialize({});
    this.selectedItem = [];
    this.clientName = "";
    this.loading = false;
    this.dateRangeValue = "";
    this.validationDate = "";
    this.syncDataWithGridTable();
    this.resetValidationStates();
    if (this.deliveryDatePicker) {
      this.deliveryDatePicker.value = "";
    }

    this.DiscountConfig = {
      Options: this.DiscountOption[0],
      Type: this.DiscountType[0],
    };
  }

  newItem() {
    this.itemAssosiate.open = true;
  }

  getClient(event: any) {
    this.SalesOrder.client_id = event.detail.item.id;
    this.clientName = event.detail.item.text;
    this.valueStateOptions.client_id = ValueState.None;
  }

  getStatus(event: any) {
    this.SalesOrder.status = event.target.value;
  }

  DiscountOptionChange(event: any) {
    this.DiscountConfig.Options = event.target.value;
    this.SalesOrder.discount_option = this.DiscountConfig.Options;

    if (this.DiscountConfig.Options === DiscountOption.ALL) {
      this.selectedItem = this.selectedItem.map((item) => ({
        ...item,
        discount: 0,
        discount_type: item.status ?? this.DiscountConfig.Options,
        total_price: item.quantity * item.received_quantity,
      }));
    } else {
      this.SalesOrder.discount = 0;
    }

    this.tableColum();
    this.syncDataWithGridTable();
  }

  DiscountTypeChange(event: any) {
    this.DiscountConfig.Type = event.target.value;
    this.SalesOrder.discount_type = this.DiscountConfig.Type;
    this.syncDataWithGridTable();
  }

  onDiscountChange(event: any) {
    this.syncDataWithGridTable();
  }
  AddClient() {
    this.client = new Client().deserialize({});
    this.saveMode = saveMode.POST;
    this.clientFormRef.open = true;
  }
  get DiscountCalculation(): number {
    let discountAmount = 0;

    if (this.DiscountConfig.Options === DiscountOption.ALL) {
      if (this.DiscountConfig.Type === DiscountType.FIXED_AMOUNT) {
        discountAmount = Number(this.SalesOrder.discount || 0);
      } else if (this.DiscountConfig.Type === DiscountType.PERCENTAGE) {
        const totalPrice = this.selectedItem.reduce(
          (sum, item) => sum + Number(item.total_price || 0),
          0
        );
        discountAmount =
          totalPrice * (Number(this.SalesOrder.discount || 0) / 100);
      }
    } else if (this.DiscountConfig.Options === DiscountOption.INDIVIDUAL) {
      this.selectedItem.forEach((item) => {
        discountAmount += Number(item.discount_amount || 0);
      });
    }

    if (this.saveMode == saveMode.POST) {
      this.SalesOrder.discount_type = this.DiscountConfig.Type;
      this.SalesOrder.discount_option = this.DiscountConfig.Options;
    }
    this.SalesOrder.discount_amount = discountAmount;
    return discountAmount;
  }
  onSaveType() {
    this.loading = true;
    this.childComponentRef?.stopEditing();
    this.selectedItem = this.getGridRows();
    this.selectedItem.forEach((item) => this.recomputeRow(item));
    this.recomputeOrderTotals();
    if (!this.validateForm()) {
      this.loading = false;
      this.goToStep(this.selectedItem.length === 0 ? 2 : 1);
      return;
    }
    if (this.SalesOrder.expected_delivery_date == "Invalid date") {
      this.validationDate = Localization.invalidDateFormat;
      this.valueStateOptions.expected_delivery_date = ValueState.Negative;
      this.loading = false;
      this.goToStep(1);
      return;
    }

    this.SalesOrder.items = this.selectedItem;
    this.SalesOrder.expected_delivery_date = moment(
      this.SalesOrder.expected_delivery_date
    ).format("YYYY-MM-DD HH:mm:ss");

    const http =
      this.saveMode == "POST"
        ? this.commonService.post("sales/create-order", this.SalesOrder, false)
        : this.commonService.put(
          `sales/update-order/${this.SalesOrder.id}`,
          this.SalesOrder,
          false
        );

    const isCreate = this.saveMode == saveMode.POST;
    http.subscribe({
      next: (res: any) => {
        if (isCreate) {
          this.triggerNotification({ id: res?.data?.id, custom_id: res?.data?.custom_id });
        }
        this.saveEvent.emit();
        this.loading = false;
        this.CloseDialog();
      },
      error: (err) => {
        console.error(err)
        this.toastService.show("error");
        this.loading = false;
        if (err.error.warnings) this.isWarning = true;
        this.salesValidationWarning = err.error.warnings;
      },
    });
  }

  private triggerNotification(data: { id?: number; custom_id?: string }): void {
    if (!data.id) return;
    this.socketService.emit("sales-order:created", {
      model_id: data.id,
      model_custom_id: data.custom_id ?? data.id,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    });
  }

  dateRangePickerChange(event: any) {
    const value = event.target.value;
    const isValid = moment(value, "YYYY-MM-DD", true).isValid();

    if (!isValid) {
      this.validationDate = Localization.invalidDateFormat;
      this.valueStateOptions.expected_delivery_date = ValueState.Negative;
      this.SalesOrder.expected_delivery_date = "Invalid date";
      return;
    }
    this.SalesOrder.expected_delivery_date = value;
    this.validationDate = "";
    this.valueStateOptions.expected_delivery_date = ValueState.None;
  }
  
  validateForm(): boolean {
    let isValid = true;
    if (!this.selectedItem || this.selectedItem.length === 0) {
      this.warningMessage = $localize`Please select at least one item.`;

      this.isWarningValidation = true;
      console.error("No items selected.");
      return false;
    }
    if (!this.SalesOrder.client_id) {
      this.valueStateOptions.client_id = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.client_id = ValueState.None;
    }
    if (
      this.clientNameCombo == null ||
      this.clientNameCombo == undefined ||
      this.clientNameCombo.value == ""
    ) {
      this.valueStateOptions.client_id = ValueState.Negative;
      isValid = false;
    }
    if (!this.SalesOrder.expected_delivery_date) {
      this.validationDate = Localization.requiredField;
      this.valueStateOptions.expected_delivery_date = ValueState.Negative;
      isValid = false;
    } else {
      this.valueStateOptions.expected_delivery_date = ValueState.None;
    }
    if (this.SalesOrder.expected_delivery_date == "Invalid date") {
      this.validationDate = Localization.invalidDateFormat;
      this.valueStateOptions.expected_delivery_date = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }
  checkValidation(event: any, field: string) {
    const value = event.target.value ? event.target.value : "";

    switch (field) {
      case "client_id": {
        const matchedClient = this.clientList.find(
          (client) => client.name.toLowerCase() === value.toLowerCase()
        );

        if (!matchedClient) {
          this.SalesOrder.client_id = undefined;
          this.clientName = "";

          if (this.clientNameCombo) {
            this.clientNameCombo.value = "";
          }

          this.valueStateOptions.client_id = ValueState.Negative;
        } else {
          this.SalesOrder.client_id = matchedClient.id;
          this.clientName = matchedClient.name;
          this.valueStateOptions.client_id = ValueState.None;
        }
        break;
      }

      case "expected_delivery_date":

        if (!value.trim()) {
          this.validationDate = Localization.requiredField;
          this.valueStateOptions.expected_delivery_date = ValueState.Negative;
        } else {
          this.SalesOrder.expected_delivery_date = moment(value).format(
            "MMM DD, YYYY HH:mm:ss A"
          );
          this.valueStateOptions.expected_delivery_date = ValueState.None;
        }
        if (
          this.SalesOrder.expected_delivery_date == "Invalid date" ||
          this.SalesOrder.expected_delivery_date == ""
        ) {
          this.validationDate = Localization.invalidDateFormat;
          this.valueStateOptions.expected_delivery_date = ValueState.Negative;
        }
        break;

      default:
        break;
    }
  }

  syncDataWithGridTable() {
    this.recomputeOrderTotals();
    this.dataSource = { ...this.dataSource, data: [...this.selectedItem] };
  }

  getDataFromAssosiate(event: any ,isnewAssociate = false) {
    const updatedEvent = event.map((item: any) => ({
      ...item,
      product_name: item.product_name ?? (this.saveMode == saveMode.POST && this.isV8 ? item?.products.product_name : this.isV8 ? item?.products?.product_name : item?.product?.product_name),
      item_code: item.item_code ?? (this.isV8 ? item.products.item_code : item.product.item_code),
      product_id: item.product?.id ?? item.id,
      received_quantity: isnewAssociate ? 0 : this.saveMode == saveMode.POST ? (item.received_quantity ?? 0) : (item.unit_price ?? 0),
      quantity: item.quantity ?? 1,
      total_price: this.saveMode == "PUT" ? (item.total_price ?? 0) : 0,
      status: item.status ?? this.SalesOrder.status,
      uom: item?.uom ?? (this.saveMode == saveMode.POST && this.isV8 ? item.products?.uoms : this.isV8 ? item.products?.uoms : item.product?.uom),
      discount: item.discount ?? 0,
      discount_type: item.discount_type ?? "NONE",
      discount_amount: item.discount_amount ?? 0,
    }));

    const merged = [...this.selectedItem, ...updatedEvent];
    const unique = merged.filter(
      (item, index, self) =>
        index === self.findIndex((i) => i.product_id === item.product_id)
    );

    this.populatedItem(unique);
  }

  populatedItem(data: any) {
    if (!Array.isArray(data)) return;
    this.tableColum();
    this.selectedItem = data.map((item: any) => ({
      item_code: item.item_code ?? "",
      product_name: item.product_name ?? "",
      product_id: item.product_id ?? 0,
      quantity: item.quantity ?? 1,
      received_quantity: item.received_quantity ?? 0,
      unit_price: this.saveMode == saveMode.POST ? 0 : item.unit_price || 0,
      stock: item.current_stock ?? 0,
      current_stock: item.current_stock ?? 0,
      currency: item.currency ?? "",
      uom: item.uom ?? "",
      status: item.status ?? '',
      id: item.id ?? null,
      min_price: item.minimum_unit_price ?? 0,
      total_price: item.total_price,
      discount: item.discount ?? 0,
      sub_total: Number(item.quantity) * Number(item.received_quantity ?? 0),
      discount_type: item.discount_type ?? "NONE",
      discount_amount: item.discount_amount ?? 0,
    }));

    this.SalesOrder.items = this.selectedItem;
    this.SalesOrder.custom_id = this.SalesOrder.custom_id ?? "";
    this.initPricePlannings();
    this.syncDataWithGridTable();
  }

  onDeleteClick(row: any) {
    this.selectedItem = this.selectedItem.filter((item) =>
      row?.product_id != null
        ? item.product_id !== row.product_id
        : item !== row
    );
    this.syncDataWithGridTable();
  }

  resetValidationStates() {
    this.valueStateOptions = {
      client_id: ValueState.None,
      expected_delivery_date: ValueState.None,
    };
    this.validationDate = "";
    this.dateRangeValue = "";
    if (this.deliveryDatePicker) {
      this.deliveryDatePicker.value = "";
      this.deliveryDatePicker.valueState = ValueState.None;
    }
  }

  initPricePlannings() {
    this.loading = true;
    this.commonService.get("sales/get-price-planning", false).subscribe({
      next: (res: any) => {
        this.pricePlannings = res;
        this.loading = false;
        this.selectedItem = this.selectedItem.map((item) => {
          const plan = this.pricePlannings.find(
            (p: any) => p.product_id === item.product_id
          );
          return plan ? { ...item, min_price: plan.price } : item;
        });
        this.syncDataWithGridTable();
      },
      error: (err) => {
        this.loading = false;
        console.error(err);
      },
    });
  }

  cilentList() {
    this.commonService.get("Clients", true).subscribe((res: any) => {
      this.clientList = res.value.map((c: any) => new Client().deserialize(c));
    this.cdRef.detectChanges();
    });
  }
  autoClientAdded(newClient: Client) {
    this.clientList = [newClient, ...this.clientList];
    this.SalesOrder.client_id = newClient.id;
    this.clientName = newClient.name || '';
    if (this.clientNameCombo) {
      this.clientNameCombo.value = newClient.name;
    }
    this.cdRef.detectChanges();
  }
  onRefreshClient() {
    this.cilentList();
  }
  async getCustomId() {
    const customId = await this.commonService.getCustomId({
      model: "sales_orders",
      prefix: "SO",
      field: "custom_id",
    });
    this.SalesOrder.custom_id = customId;
  }

  tableColum() {
    const editable = !this.isDisabled;
    const isIndividual =
      this.SalesOrder.discount_option === DiscountOption.INDIVIDUAL;

    const cols: AgGridTableColumn<any>[] = [
      { field: "item_code", headerName: $localize`Item Code`, width: 140, editable: false },
      { field: "product_name", headerName: $localize`Name`, minWidth: 160, editable: false },
      {
        field: "quantity",
        headerName: $localize`Requested Qty`,
        width: 150,
        type: "numericColumn",
        editable: false,
        ...(editable
          ? {
              cellRenderer: AgGridQtyStepperCellRendererComponent,
              cellRendererParams: {
                min: 1,
                onChanged: (_row: any, _qty: number) => this.onCellEdited(null),
              },
            }
          : {}),
      },
      {
        field: "received_quantity",
        headerName: $localize`Price`,
        width: 140,
        type: "numericColumn",
        editable: false,
        ...(editable ? { inlineEditor: { type: "input" as const } } : {}),
      },
      { field: "min_price", headerName: $localize`Min Price`, width: 120, type: "numericColumn", editable: false },
      {
        field: "discount",
        headerName: $localize`Discount`,
        width: 130,
        type: "numericColumn",
        editable: false,
        initiallyVisible: isIndividual,
        ...(editable && isIndividual ? { inlineEditor: { type: "input" as const } } : {}),
      },
      {
        field: "discount_type",
        headerName: $localize`Discount Type`,
        width: 150,
        initiallyVisible: isIndividual,
        editable: editable && isIndividual,
        ...(editable && isIndividual
          ? {
              editor: {
                type: "select" as const,
                options: this.DiscountType.map((t) => ({ value: t, label: t })),
              },
            }
          : {}),
      },
      { field: "total_price", headerName: $localize`Total Price`, width: 130, type: "numericColumn", editable: false },
      {
        colId: "uom.name",
        headerName: $localize`Unit`,
        width: 110,
        editable: false,
        valueGetter: (p: any) => p.data?.uom?.name ?? "",
      },
    ];

    if (editable) {
      cols.push({
        field: "actions",
        headerName: $localize`Action`,
        width: 100,
        minWidth: 100,
        pinned: "right",
        lockPinned: true,
        sortable: false,
        filter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: [
            {
              id: "delete",
              label: "",
              icon: "delete",
              design: "Transparent",
              tooltip: $localize`Delete`,
              disabled: () => !this.showNewButton || this.isDisabled,
            } as AgGridTableRowAction<any>,
          ],
          onAction: (_actionId: string, row: any) => this.onDeleteClick(row),
        },
      });
    }

    this.column = cols;
    this.toolbarConfig = { ...this.toolbarConfig, showNewButton: this.showNewButton };
  }

  onCellEdited(_event: any): void {
    const rows = this.getGridRows();
    rows.forEach((row) => this.recomputeRow(row));
    this.selectedItem = rows;
    this.recomputeOrderTotals();
    this.childComponentRef?.getGridApi()?.refreshCells({ force: true });
  }

  private getGridRows(): any[] {
    const api = this.childComponentRef?.getGridApi();
    if (!api) return this.selectedItem;
    const rows: any[] = [];
    api.forEachNode((node: any) => {
      if (node?.data) rows.push(node.data);
    });
    return rows.length ? rows : this.selectedItem;
  }

  private recomputeRow(item: any): void {
    const quantity = Number(item.quantity) || 0;
    const received = Number(item.received_quantity) || 0;
    const discount = Number(item.discount) || 0;
    const subTotal = quantity * received;
    const discountType =
      this.DiscountConfig.Options === DiscountOption.ALL
        ? this.DiscountConfig.Type
        : item.discount_type;
    const discountAmount =
      discountType === DiscountType.FIXED_AMOUNT
        ? discount
        : subTotal * (discount / 100);
    item.sub_total = subTotal;
    item.discount_amount = discountAmount;
    item.total_price = Math.max(subTotal - discountAmount, 0);
  }

  private recomputeOrderTotals(): void {
    const subTotal = this.selectedItem.reduce(
      (sum, item) => sum + Number(item.sub_total || 0),
      0
    );
    const vat = subTotal * 0.075;
    const grandTotal = subTotal + vat - this.DiscountCalculation;
    this.SalesOrder.subtotal = subTotal;
    this.SalesOrder.vat = vat;
    this.SalesOrder.grand_total = grandTotal >= 0 ? grandTotal : 0;
  }

  associateTableColum() {
    return [{ accessor: "item_code" }, { accessor: "product_name" }];
  }
}
