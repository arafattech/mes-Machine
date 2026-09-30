import {
  Component,
  EventEmitter,
  Input,
  OnInit,
  Output,
  ViewChild,
} from "@angular/core";

import { CommonService } from "@app/services/common-service/common.service";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import { ToastService } from "@app/services/toast-service/toast.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { User } from "@app/shared/model/user";
import { AuthService } from "@app/services/auth-service/auth.service";
import { MaterialReceipt } from "@store-module/shared/model/materialReceipt";
import ValueState from "@ui5/webcomponents-base/dist/types/ValueState.js";
import { SocketService } from "@app/services/socket.service";
import "@ui5/webcomponents-fiori/dist/Wizard.js";
import "@ui5/webcomponents-fiori/dist/WizardStep.js";

interface CottonLotDraft {
  product_id: number | null;
  product_name: string;
  item_code: string;
  lot_number: string;
  bale_quantity: number | null;
  gross_weight_kg: number | null;
  tare_weight_kg: number | null;
  net_weight_kg: number | null;
  moisture_pct: number | null;
  received_date: string | null;
  remarks: string | null;
}

@Component({
  selector: "app-mrr-from",
  templateUrl: "./mrr-from.component.html",
  styleUrl: "./mrr-from.component.scss",
})
export class MRRFromComponent implements OnInit {
  @ViewChild("childComponentRef") childComponentRef!: AgGridTableComponent;
  @Input() saveMode = "POST";
  @Input() selectedData: any;
  @Input() source: "LOCAL" | "IMPORTED" = "LOCAL";
  @Input() readOnly = false;
  @Output() saveEvent = new EventEmitter<any>();

  open: boolean = false;
  loading: boolean = false;
  public localization = Localization;
  public authUser: User = new User();
  public receipt: MaterialReceipt = new MaterialReceipt();
  public column: AgGridTableColumn<any>[] = [];
  public dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };
  public toolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Items`,
    showSearch: true,
    showRowCount: true,
    showDownload: false,
    showNewButton: false,
  };
  public displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 560px)",
    fillEmptyRows: false,
  };
  ToastType: "add" | "edit" | "error" = "add";
  private newSrData: { id: number; custom_id?: string } | null = null;
  public cottonLots: CottonLotDraft[] = [];
  public rawCottonLotsHeader = $localize`Raw Cotton Lots`;
  private generatingLotNumbers = false;
  public departmentName: string = "";
  public receiptStatus: string = "PARTIAL";
  public poName: string = "";
  public supplierName: string = "";
  public POList: any[] = [];
  public selectedItem: any[] = [];
  public warningMessage: string = "";
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;

  public currentStep = 1;

  get hasCottonLotStep(): boolean {
    return this.source === "IMPORTED" && this.cottonLots.length > 0;
  }

  get totalSteps(): number {
    return this.hasCottonLotStep ? 3 : 2;
  }

  /** Step index (1-based) that holds the Items grid — the last step either way. */
  get itemsStepIndex(): number {
    return this.totalSteps;
  }

  goToStep(step: number): void {
    if (step < 1 || step > this.totalSteps) return;
    this.currentStep = step;
  }

  nextStep(): void {
    this.goToStep(this.currentStep + 1);
  }

  prevStep(): void {
    this.goToStep(this.currentStep - 1);
  }

  onWizardStepChange(event: any): void {
    const index = Number(event?.detail?.step?.dataset?.step ?? event?.detail?.stepIndex);
    if (!Number.isNaN(index) && index >= 1) {
      this.currentStep = index;
    }
  }
  public valueStateOptions: {
    custom_id: ValueState;
    receipt_date: ValueState;
    purchase_order: ValueState;
    supplier: ValueState;
    invoice_no: ValueState;
    lc_no: ValueState;
  } = {
    custom_id: ValueState.None,
    receipt_date: ValueState.None,
    purchase_order: ValueState.None,
    supplier: ValueState.None,
    invoice_no: ValueState.None,
    lc_no: ValueState.None,
  };

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private authService: AuthService,
    private socketService: SocketService,
  ) {
    this.authUser = this.authService.user();
    this.tableColum();
    this.getPOList();
  }

  ngOnInit(): void {}

  get isPartialReadOnly(): boolean {
    return this.saveMode === saveMode.PUT && this.receiptStatus === 'PARTIAL';
  }

  private isCottonItem(item: any): boolean {
    return !!item.is_lot;
  }

  get hasCottonItem(): boolean {
    return this.selectedItem.some((item) => this.isCottonItem(item));
  }

  private async generateLotNumbers(): Promise<void> {
    if (this.generatingLotNumbers) return;
    this.generatingLotNumbers = true;

    try {
      const cottonItems = this.selectedItem.filter((item) => this.isCottonItem(item));
      for (const item of cottonItems) {
        const alreadyGenerated = this.cottonLots.some((lot) => lot.product_id === (item.product_id ?? null));
        if (alreadyGenerated) continue;

        try {
          const lotNumber = await this.commonService.getCustomId({
            model: 'lots',
            prefix: 'LOT',
            field: 'lot_number',
          });
          this.cottonLots = [
            ...this.cottonLots,
            {
              product_id: item.product_id ?? null,
              product_name: item.product_name ?? '',
              item_code: item.item_code ?? '',
              lot_number: lotNumber,
              bale_quantity: 0,
              gross_weight_kg: 0,
              tare_weight_kg: 0,
              net_weight_kg: 0,
              moisture_pct: 0,
              received_date: null,
              remarks: null,
            },
          ];
        } catch (error) {
          console.error('Error occurred while generating raw cotton lot number:', error);
        }
      }
    } finally {
      this.generatingLotNumbers = false;
    }
  }

  tableColum() {
    this.column = [
      {
        field: "item_code",
        headerName: $localize`Item Code`,
        minWidth: 140,
        editable: false,
      },
      {
        field: "product_name",
        headerName: $localize`Name`,
        minWidth: 160,
        editable: false,
      },
      {
        colId: "uom.name",
        headerName: $localize`Unit`,
        width: 110,
        editable: false,
        valueGetter: (p: any) => p.data?.uom?.name ?? "",
      },
      {
        field: "required_quantity",
        headerName: $localize`Required Qty`,
        width: 140,
        type: "numericColumn",
        editable: false,
        valueGetter: (p: any) => p.data?.required_quantity ?? 0,
      },
      {
        field: "received_quantity",
        headerName: $localize`Received Qty`,
        width: 150,
        type: "numericColumn",
        editable: false,
        valueGetter: (p: any) => p.data?.received_quantity ?? 0,
      },
      {
        field: "remark",
        headerName: $localize`Remarks`,
        minWidth: 200,
        editable: false,
        inlineEditor: { type: "input" },
      },
    ];
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

  async getCustomId() {
    const customId = await this.commonService.getCustomId({
      model: "material_receipts",
      prefix: "MRR",
      field: "custom_id",
    });

    this.receipt.custom_id = customId;
  }

  async onSaveType() {
    if (this.saveMode === saveMode.PUT && this.receipt.status === 'COMPLETED') {
      this.warningMessage = $localize`Completed MRR cannot be modified.`;
      return;
    }
    this.loading = true;
    this.warningMessage = "";
    this.childComponentRef?.stopEditing();
    this.selectedItem = this.getGridRows();

    if (this.saveMode === saveMode.POST && this.source === "IMPORTED" && this.hasCottonItem) {
      await this.generateLotNumbers();
    }

    if (!this.validateForm()) {
      this.loading = false;
      this.toastService.show("error");
      console.error("Material receipt validation failed.", {
        receipt: this.receipt,
        items: this.selectedItem,
      });
      return;
    }
    const receiptPayload = new MaterialReceipt().deserialize({
      ...this.receipt,
      requested_by: this.authUser.id,
      source: this.source,
      items: this.selectedItem,
    });

    const request$ =
      this.saveMode === saveMode.POST
        ? this.commonService.post("store/material-receipts", receiptPayload.toOdata(), false)
        : this.commonService.put(
            `store/material-receipts/${this.selectedData.id}`,
            receiptPayload.toOdata(),
            false
          );

    request$.subscribe({
      next: (response: any) => {
        this.ToastType = this.saveMode === saveMode.POST ? "add" : "edit";
        if (this.saveMode === saveMode.POST) {
          this.newSrData = { id: response.id, custom_id: response.custom_id };
          if (this.receipt.purchase_order_id) {
            this.commonService.put(
              `PurchaseOrders(${this.receipt.purchase_order_id})`,
              { is_mrr_created: true },
              true
            ).subscribe();
          }
          if (this.source === "IMPORTED" && this.cottonLots.length) {

            const receiptItems: any[] = response.receipt_items ?? [];
            this.cottonLots.forEach((lot) => {
              const receiptItem = receiptItems.find(
                (ri: any) => Number(ri.product_id) === Number(lot.product_id),
              );
              this.commonService.post(
                "Lots",
                {
                  lot_number: lot.lot_number,
                  product_id: lot.product_id,
                  mrr_item_id: receiptItem?.id ?? null,
                  bale_quantity: lot.bale_quantity ?? 0,
                  gross_weight_kg: lot.gross_weight_kg,
                  tare_weight_kg: lot.tare_weight_kg,
                  net_weight_kg: lot.net_weight_kg,
                  moisture_pct: lot.moisture_pct,
                  received_date: lot.received_date,
                  remarks: lot.remarks,
                  status: "IN_STOCK",
                },
                true,
              ).subscribe({
                error: (error: any) =>
                  console.error("Error occurred while creating raw cotton lot:", error),
              });
            });
          }
        }
        this.afterSuccessSave();
        this.getPOList();
      },
      error: (error: any) => {
        this.loading = false;
        this.warningMessage = this.extractWarningMessage(error);
        this.toastService.show("error");
        console.error("Error occurred while saving material receipt:", error);
      },
    });
  }

  checkValidation(event: any, field: string): void {
    const value = event?.target?.value ?? "";
    (this.valueStateOptions as Record<string, ValueState>)[field] =
      String(value).trim().length > 0
        ? this.valueState.None
        : this.valueState.Negative;
  }

  resetValueState(): void {
    this.valueStateOptions = {
      custom_id: this.valueState.None,
      receipt_date: this.valueState.None,
      purchase_order: this.valueState.None,
      supplier: this.valueState.None,
      invoice_no: this.valueState.None,
      lc_no: this.valueState.None,
    };
  }

  validateForm(): boolean {
    this.warningMessage = "";
    this.resetValueState();
    let isValid = true;

    if (!this.receipt.custom_id) {
      this.valueStateOptions['custom_id'] = this.valueState.Negative;
      isValid = false;
    }
    if (!this.receipt.receipt_date) {
      this.valueStateOptions['receipt_date'] = this.valueState.Negative;
      isValid = false;
    }
    if (!this.receipt.purchase_order_id) {
      this.valueStateOptions['purchase_order'] = this.valueState.Negative;
      isValid = false;
    }
    if (!this.receipt.supplier_id) {
      this.valueStateOptions['supplier'] = this.valueState.Negative;
      isValid = false;
    }
    if (this.source === "IMPORTED") {
      if (!this.receipt.invoice_no) {
        this.valueStateOptions['invoice_no'] = this.valueState.Negative;
        isValid = false;
      }
      if (!this.receipt.lc_no) {
        this.valueStateOptions['lc_no'] = this.valueState.Negative;
        isValid = false;
      }
    }

    if (!isValid) {
      return false;
    }

    // Receiving happens exclusively through ReceiveQtyFormComponent now — this form (both
    // create and header-only edit) never submits a nonzero receiving_quantity, so the old
    // "at least one received quantity > 0" PUT-mode check would always fail. Only require
    // that the PO actually has items, for both modes.
    if (!this.getGridRows().length) {
      this.warningMessage = $localize`Select a purchase order with items.`;
      return false;
    }

    return true;
  }

  private getTodayFormatted(): string {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  // Caps the receipt date picker at today (future dates disabled).
  get todayFormatted(): string {
    return this.getTodayFormatted();
  }

  CloseDialog() {
    this.open = false;
    this.warningMessage = "";
    this.currentStep = 1;
  }

  reset() {
    this.receipt = new MaterialReceipt().deserialize({
      source: this.source,
      status: "PARTIAL",
      requested_by: this.authUser.id,
      receipt_date: this.getTodayFormatted(),
    });

    this.receiptStatus = "PARTIAL";
    this.poName = "";
    this.supplierName = "";
    this.selectedItem = [];
    this.warningMessage = "";
    this.cottonLots = [];
    this.currentStep = 1;
    this.resetValueState();
    this.syncDataWithGridTable();
    this.getPOList();
  }

  getPO(items: any) {
    const selectedItem = items.detail.item;
    if (!selectedItem) return;

    this.poName = selectedItem.text;
    const id = Number(selectedItem.id);
    const selectedData = this.POList.find((item: any) => item.id === id);

    if (!selectedData) return;

    this.receipt.purchase_order_id = selectedData.id;
    this.receipt.purchase_requisition_id = selectedData.spr_id ?? selectedData.requisition?.id ?? null;
    this.receipt.department_id = selectedData.department_id ?? selectedData.department?.id ?? null;
    this.receipt.supplier_id = selectedData.supplier_id ?? null;
    this.supplierName = selectedData.supplier?.name ?? "";
    this.valueStateOptions['purchase_order'] = this.valueState.None;
    if (this.receipt.supplier_id) {
      this.valueStateOptions['supplier'] = this.valueState.None;
    }
    this.selectedItem = (selectedData.poItems ?? [])
      .map((item: any) => {
        const ordered = Number(item.quantity ?? 0);
        const alreadyReceived = Number(item.received_quantity ?? 0);
        const remaining = Math.max(ordered - alreadyReceived, 0);
        return {
          item_code: item.item?.item_code ?? "",
          product_name: item.item?.product_name ?? "",
          product_id: item.item?.id ?? null,
          is_lot: item.item?.is_lot ?? false,
          required_quantity: ordered,
          received_quantity: alreadyReceived,
          remaining_quantity: remaining,
          receiving_quantity: 0,
          uom: item.item?.uom ?? { name: "" },
          remark: "",
          po_item_id: item.id ?? null,
        };
      })
      .filter((item: any) => item.remaining_quantity > 0);

    this.syncDataWithGridTable();

    this.cottonLots = [];
    if (this.source === "IMPORTED" && this.hasCottonItem) {
      this.generateLotNumbers();
    }
  }

  getReceiptPopulated(data: any) {
    this.tableColum();
    this.warningMessage = "";
    this.receipt = new MaterialReceipt().deserialize({
      id: data.id,
      custom_id: data.custom_id,
      purchase_order_id: data.purchase_order_id,
      purchase_requisition_id: data.purchase_requisition_id,
      supplier_id: data.supplier_id,
      department_id: data.department_id,
      requested_by: data.requested_by,
      receipt_date: data.receipt_date,
      remarks: data.remarks,
      source: data.source,
      invoice_no: data.invoice_no,
      lc_no: data.lc_no,
      vehicle_no: data.vehicle_no,
      status: data.status,
    });

    this.receiptStatus = data.status ?? "PARTIAL";
    this.poName = data.purchaseOrder?.custom_id ?? "";
    this.supplierName = data.supplier?.name ?? "";
    const poItemById = new Map<number, any>(
      (data.purchaseOrder?.po_items ?? data.purchaseOrder?.poItems ?? []).map((pi: any) => [
        Number(pi.id),
        pi,
      ])
    );
    this.selectedItem = (data.receiptItems ?? [])
      .map((item: any) => {
        const poItem = poItemById.get(Number(item.po_item_id));
        const ordered = Number(poItem?.quantity ?? 0);
        const totalReceived = Number(item.received_quantity ?? 0);
        const remaining = Math.max(0, ordered - totalReceived);
        return {
          item_code: item.item?.item_code ?? "",
          product_name: item.item?.product_name ?? "",
          product_id: item.product_id,
          is_lot: item.item?.is_lot ?? false,
          required_quantity: ordered,
          received_quantity: totalReceived,
          remaining_quantity: remaining,
          receiving_quantity: remaining,
          uom: item.item?.uom ?? { name: "" },
          remark: item.remark ?? "",
          po_item_id: item.po_item_id ?? null,
        };
      })
      .filter((item: any) => this.readOnly || item.remaining_quantity > 0);

    this.syncDataWithGridTable();
  }

  syncDataWithGridTable() {
    this.dataSource = { ...this.dataSource, data: [...this.selectedItem] };
  }

  getPOList() {
    const importedFilter = this.source === "IMPORTED" ? "is_imported eq true" : "is_imported eq false";
    const poUrl =
      `PurchaseOrders?$filter=status ne 'CANCELED' and status ne 'RECEIVED' and is_complete eq false and is_mrr_created eq false and ${importedFilter}` +
      "&$orderby=id desc&$expand=poItems($expand=item($expand=category,uom)),department,supplier,requisition";

    this.commonService.get(poUrl).subscribe({
      next: (res: any) => {
        this.POList = res.value ?? [];
      },
      error: (error: any) => {
        this.toastService.show("error");
        console.error("Error occurred while loading purchase orders:", error);
      },
    });
  }

  afterSuccessSave() {
    this.loading = false;
    this.toastService.show(this.ToastType);
    this.CloseDialog();
    this.saveEvent.emit();
    if (this.newSrData) {
      this.triggerSrNotification(this.newSrData);
      this.newSrData = null;
    }
  }

  private triggerSrNotification(sr: { id: number; custom_id?: string }): void {
    const event = this.source === 'IMPORTED' ? 'store-importedmrr:created' : 'store-localrrm:created';
    this.socketService.emit(event, {
      model_id: sr.id,
      model_custom_id: sr.custom_id ?? sr.id,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    });
  }
  private extractWarningMessage(error: any): string {
    const validationMessages = error?.error?.errors;
    if (validationMessages && typeof validationMessages === "object") {
      const firstMessage = Object.values(validationMessages).flat()[0];
      if (typeof firstMessage === "string") {
        return firstMessage;
      }
    }

    if (typeof error?.error?.message === "string" && error.error.message) {
      return error.error.message;
    }

    return $localize`Unable to save material receipt. Please review the entered quantities.`;
  }
}
