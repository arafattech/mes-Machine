import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import ValueState from "@ui5/webcomponents-base/dist/types/ValueState.js";
import { ToastService } from "@app/services/toast-service/toast.service";
import {
  SprStatus,RequisitionUrgency
} from "@store-module/shared/enum/spr-status";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import { AgGridActionCellRendererComponent } from "@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component";
import {
  AgGridTableCellEditEvent,
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { Product } from "@app/shared/model/product";
import { User } from "@app/shared/model/user";
import { PurchaseRequisition } from "@store-module/shared/model/purchaseRequisition";
import { AssosiateComponent } from "@app/shared/components/assosiate/assosiate.component";
import { Department } from "@app/shared/model/department";
import { AuthService } from "@app/services/auth-service/auth.service";
import { SocketService } from "@app/services/socket.service";
import { environment } from "@env/environment";
import "@ui5/webcomponents-fiori/dist/Wizard.js";
import "@ui5/webcomponents-fiori/dist/WizardStep.js";

@Component({
  selector: "app-requisition-from",
  templateUrl: "./requisition-from.component.html",
  styleUrl: "./requisition-from.component.scss",
})
export class RequisitionFromComponent implements OnInit, OnChanges {
  @ViewChild("childComponentRef") childComponentRef!: AgGridTableComponent;
  @ViewChild("itemAssosiate") itemAssosiate!: AssosiateComponent;
  @Input() saveMode = "POST";
  @Input() selectedData: any;
  @Input() isReadOnly: boolean = false;
  @Input() isDepartmentReadOnly: boolean = false;
  @Input() isRequiredByReadOnly: boolean = false;
  @Input() requisitionType = "SPR";
  @Input() canApprove = true;
  @Input() canFinalApprove = false;
  // The SR per-person approval-chain Approve/Reject only belongs on the review screen
  // (sr-request.component) — the create/edit screen (store-requisition.component) is
  // where the request itself is authored, not approved, so it stays Submit/Cancel only.
  @Input() showApprovalActions = true;
  @Output() saveEvent = new EventEmitter<any>();

  open: boolean = false;
  loading: boolean = false;
  RequisitionUrgency = RequisitionUrgency;
  public isStatusReadOnly: boolean = false;
  public isWarning: boolean = false;
  public warningMessage: string = "";
  ToastType: "add" | "edit" | "error" = "add";
  public validationMessage = Localization.requiredField;
  public valueState = ValueState;
  public responseType: saveMode = saveMode.POST;
  public localization = Localization;
  public selectedItem: any[] = [];
  public departments: Department[] = [];
  public product = Product;
  title: string = $localize`Items to Purchase`;
  public authUser: User = new User();
  public Spr: PurchaseRequisition = new PurchaseRequisition();
  private newSrData: { id: number; custom_id?: string } | null = null;
  private pendingSrActionNotification: { event: string; id: number; custom_id?: string } | null = null;
  private newSprData: { id: number; custom_id?: string } | null = null;
  private pendingSprActionNotification: { event: string; id: number; custom_id?: string } | null = null;
  public departmentName: string = "";
  public urgencyTitle: string = "";
  public indentTypeTitle: string = "";
  public indentTypeOptions = [
    { value: "LOCAL", text: $localize`Local` },
    { value: "FOREIGN", text: $localize`Foreign` },
  ];
  public showNewButton: boolean = true;
  public column: AgGridTableColumn<any>[] = [];
  public dataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "",
    staticData: true,
    data: [],
  };
  public toolbarConfig: AgGridTableToolbarConfig = {};
  public displayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 560px)",
    fillEmptyRows: false,
  };
  public statusEnum = SprStatus;
  public stockTitle = Localization.currentStock;
  public srApprovalSteps: {
    id: number;
    name: string;
    designation: string;
    photoUrl: string;
    isRequired: boolean;
    status: 'approved' | 'rejected' | 'pending';
    isCurrentUser: boolean;
    isCurrentStep: boolean;
  }[] = [];
  public approvingSrStep = false;
  public loadingSrApprovalSteps = false;
  public srApprovalStepsConfirmed = false;
  public urgencyOptions = Object.values(RequisitionUrgency).map((urgency) => ({
    value: urgency,
    text: urgency,
  }));

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
    private authService: AuthService,
    private socketService: SocketService,
  ) {
    this.getDepartments();
    this.authUser = this.authService.user();
  }
  ngOnChanges(changes: SimpleChanges): void {}

  ngOnInit(): void {
    this.tableColum();
  }

  get quantityHeaderText() {
    return this.requisitionType === "SR"
      ? $localize`SR Qty`
      : $localize`Indent Qty`;
  }

  get idLabelText() {
    return this.requisitionType === "SR"
      ? $localize`SR No`
      : $localize`Indent No`;
  }

  get descriptionLabelText() {
    return this.requisitionType === "SPR"
      ? $localize`Note`
      : $localize`Justification`;
  }

  tableColum() {
    // Requested (Indent/SR) quantity locks the moment GM approves — regardless of
    // how the parent wired showNewButton — since it's the requester's original ask,
    // not something to revise post-approval.
    const isGmApprovedOrBeyond =
      this.Spr.status === SprStatus.APPROVED ||
      this.Spr.status === SprStatus.FINAL_APPROVAL ||
      this.Spr.status === SprStatus.REJECTED;
    const canEditQty = this.showNewButton && !isGmApprovedOrBeyond;
    // Approved qty is GM's call at the SUBMITTED step only — once GM approves it
    // locks for good, final approval no longer revises it.
    const canEditApproved =
      this.isRequestMode() &&
      this.Spr.status === SprStatus.SUBMITTED &&
      this.canApprove;

    const columns: AgGridTableColumn<any>[] = [
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
        field: "stock",
        headerName: this.stockTitle,
        width: 110,
        type: "numericColumn",
        editable: false,
        valueGetter: (p: any) => p.data?.stock ?? 0,
      },
    ];

    const qtyCol: AgGridTableColumn<any> = {
      field: "quantity",
      headerName: this.quantityHeaderText,
      width: 160,
      type: "numericColumn",
      editable: false,
    };
    if (canEditQty) {
      qtyCol.inlineEditor =
        this.requisitionType === "SR"
          ? {
              type: "stepInput",
              min: 0,
              maxField: "stock",
              disabledWhenMaxZero: true,
            }
          : { type: "stepInput", min: 0 };
    } else {
      qtyCol.inlineEditor = { type: "stepInput", min: 0, disabled: true };
    }
    columns.push(qtyCol);

    if (this.shouldShowApprovedQtyColumn()) {
      const approvedCol: AgGridTableColumn<any> = {
        field: "approved_qty",
        headerName: $localize`Approved Qty`,
        width: 140,
        type: "numericColumn",
        editable: false,
      };
      if (canEditApproved) {
        approvedCol.inlineEditor = { type: "stepInput", min: 0 };
      } else {
        approvedCol.inlineEditor = { type: "stepInput", min: 0, disabled: true };
      }
      columns.push(approvedCol);
    }

    columns.push({
      colId: "uom.name",
      headerName: $localize`Unit`,
      width: 110,
      editable: false,
      valueGetter: (p: any) => p.data?.uom?.name ?? "",
    });

    if (canEditQty || canEditApproved) {
      columns.push({
        colId: "__row_actions__",
        headerName: $localize`Action`,
        width: 90,
        minWidth: 80,
        pinned: "right",
        lockPinned: true,
        sortable: false,
        filter: false,
        floatingFilter: false,
        editable: false,
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions: [
            {
              id: "delete",
              label: "",
              icon: "delete",
              tooltip: $localize`Remove`,
              design: "Negative",
            },
          ],
          onAction: (actionId: string, row: any) => {
            if (actionId === "delete") this.onDeleteClick(row);
          },
        },
      });
    }

    this.column = columns;
    this.toolbarConfig = {
      headerTitle: this.title,
      showSearch: true,
      showRowCount: true,
      showDownload: false,
      showNewButton: this.showNewButton,
      addButtonText: $localize`Associate`,
    };
  }

  onDeleteClick(row: any) {
    this.selectedItem = this.selectedItem.filter((item) =>
      row.item_id != null ? item.item_id !== row.item_id : item.id !== row.id
    );
    this.syncDataWithGridTable();
  }

  async getCustomId() {
    const customId = await this.commonService.getCustomId({
      model: "purchase_requisitions",
      prefix: "BTL-Indent",
      field: "custom_id",
    });

    this.Spr.custom_id = customId;
  }

  async getSrCustomId() {
    const customId = await this.commonService.getCustomId({
      model: "purchase_requisitions",
      prefix: "SR",
      field: "custom_id",
    });

    this.Spr.custom_id = customId;
  }

  getDepartments() {
    this.commonService.get("/Departments", true).subscribe((res: any) => {
      this.departments = res.value;
    });
  }

  autoSelectDepartmentFromEmployee(): void {
    const userId = this.authUser?.id;
    if (!userId) return;

    this.commonService
      .get(`Employees?$filter=user_id eq ${userId}&$expand=department`, true)
      .subscribe({
        next: (res: any) => {
          const employee = res?.value?.[0];
          const departmentId = employee?.department_id;
          if (departmentId) {
            this.Spr.department_id = Number(departmentId);
            this.departmentName = employee?.department?.name ?? "";

            this.isDepartmentReadOnly =
              this.departmentName.trim().toLowerCase() !== "store";
          }
        },
        error: (error: any) => {
          console.error(
            "Error occurred while loading employee department:",
            error
          );
        },
      });
  }
  async onSaveType(targetStatus?: SprStatus) {
    this.loading = true;
    if (!this.validateForm(targetStatus)) {
      this.loading = false;
      return;
    }
    this.childComponentRef?.stopEditing();
    let url = "";
    let request$;
    const isRequestMode = this.isRequestMode();
    const currentStatus = this.Spr.status;
    const isReject = targetStatus === SprStatus.REJECTED;
    const isLevel1Approve =
      isRequestMode && !isReject && currentStatus === SprStatus.SUBMITTED;
    const isFinalApprove =
      isRequestMode && !isReject && currentStatus === SprStatus.APPROVED;

    let requisitionStatus: SprStatus | undefined;
    if (!isRequestMode) {
      requisitionStatus = SprStatus.SUBMITTED;
    } else if (isReject) {
      requisitionStatus = SprStatus.REJECTED;
    } else {
      requisitionStatus = SprStatus.APPROVED;
    }
    this.Spr.status = requisitionStatus;

    if (this.saveMode === saveMode.POST) {
      url = "PurchaseRequisitions";
      this.ToastType = "add";
      const payload = {
        ...this.Spr.toOdata(),
        requested_by: this.authUser.id,
        type: this.requisitionType,
        status: requisitionStatus,
        is_complete: false,
        rejected_reason:
          requisitionStatus === SprStatus.REJECTED
            ? this.Spr.rejected_reason
            : "",
      };
      request$ = this.commonService.post(url, payload, true);
    } else {
      url = `PurchaseRequisitions(${this.selectedData.id})`;
      this.ToastType = "edit";
      const payload = {
        ...this.Spr.toOdata(),
        requested_by: this.Spr.requested_by ?? this.authUser.id,
        type: this.requisitionType,
        status: requisitionStatus,
        approved_by: isLevel1Approve ? this.authUser.id : this.Spr.approved_by,
        approved_at: isLevel1Approve
          ? new Date().toISOString()
          : this.Spr.approved_at,
        rejected_reason:
          requisitionStatus === SprStatus.REJECTED
            ? this.Spr.rejected_reason
            : "",
      };
      request$ = this.commonService.put(url, payload, true);
    }

    if (request$) {
      request$.subscribe({
        next: (response: any) => {
          if (this.saveMode === saveMode.POST) {
            if (this.requisitionType === 'SR') {
              this.newSrData = { id: response.id, custom_id: response.custom_id };
            } else if (this.requisitionType === 'SPR') {
              this.newSprData = { id: response.id, custom_id: response.custom_id };
            }
            this.createBatchRequest(this.selectedItem, response.id);
          } else {
            if (this.requisitionType === 'SR') {
              if (requisitionStatus === SprStatus.REJECTED) {
                this.pendingSrActionNotification = {
                  event: 'store-requisition:rejected',
                  id: this.selectedData.id,
                  custom_id: this.selectedData.custom_id,
                };
              } else if (requisitionStatus === SprStatus.APPROVED) {
                this.pendingSrActionNotification = {
                  event: 'store-requisition:approved',
                  id: this.selectedData.id,
                  custom_id: this.selectedData.custom_id,
                };
              }
            } else if (this.requisitionType === 'SPR' && this.saveMode !== saveMode.REQUEST) {
              if (requisitionStatus === SprStatus.REJECTED) {
                this.pendingSprActionNotification = {
                  event: 'store-spr:rejected',
                  id: this.selectedData.id,
                  custom_id: this.selectedData.custom_id,
                };
              } else if (requisitionStatus === SprStatus.APPROVED) {
                this.pendingSprActionNotification = {
                  event: 'store-spr:approved',
                  id: this.selectedData.id,
                  custom_id: this.selectedData.custom_id,
                };
              }
            }
            this.updateBatchRequest(
              this.selectedItem,
              response.id,
              response,
              isFinalApprove,
            );
          }
        },
        error: (error: any) => {
          this.loading = false;
          this.toastService.show("error");
          console.error("Error occurred while saving:", error);
        },
      });
    }
  }

  createBatchRequest(items: any, id: number) {
    if (!items || items.length === 0) {
      this.loading = false;
      this.toastService.show("add");
      this.CloseDialog();
      this.saveEvent.emit();
      return;
    }
    const batchPayload = {
      requests: items.map((item: any, index: number) => ({
        id: index,
        method: "POST",
        url: "/odata/PurchaseRequisitionItems",
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          spr_id: id,
          product_id: item.id,
          required_quantity: item.quantity ?? 1,
          approved_qty: item.quantity ?? item.approved_qty ?? 1,
          received_quantity: item.received_quantity ?? 0,
          previous_stock: 0,
          unit_price: item.unit_price ?? 0,
          total_price:
            item.total_price ??
            Number(item.quantity ?? 1) * Number(item.unit_price ?? 0),
          status: item.urgency ?? "LOW",
        },
      })),
    };

    this.commonService.post("$batch", batchPayload, true).subscribe({
      next: (res: any) => {
        this.afterSuccessSave();
      },
      error: (error: any) => {
        this.loading = false;
        this.toastService.show("error");
        console.error("Error occurred while saving:", error);
      },
    });
  }
  updateBatchRequest(
    items: any,
    id: number,
    _response: any,
    isFinalApprove = false,
  ) {
    if (!items || items.length === 0) {
      if (isFinalApprove) {
        this.finalApproveRequisition(id);
        return;
      }
      this.loading = false;
      this.toastService.show("add");
      this.CloseDialog();
      this.saveEvent.emit();
      this.emitPendingSrActionNotification();
      this.emitPendingSprActionNotification();
      return;
    }
    const requests: any[] = items.map((item: any, index: number) => {
      const isExisting = item.item_id != null;
      return {
        id: index,
        method: isExisting ? "PUT" : "POST",
        url: isExisting
          ? "/odata/PurchaseRequisitionItems(" + item.item_id + ")"
          : "/odata/PurchaseRequisitionItems",
        headers: {
          "Content-Type": "application/json",
        },
        body: {
          spr_id: id,
          product_id: item.id,
          required_quantity: item.quantity ?? 1,
          approved_qty:
            this.isRequestMode()
              ? item.approved_qty ?? item.quantity ?? 1
              : item.quantity ?? item.approved_qty ?? 1,
          received_quantity: item.received_quantity ?? 0,
          previous_stock: item.stock,
          unit_price: item.unit_price ?? 0,
          total_price:
            this.isRequestMode()
              ? Number(item.approved_qty ?? item.quantity ?? 1) *
                Number(item.unit_price ?? 0)
              : Number(item.quantity ?? item.approved_qty ?? 1) *
                Number(item.unit_price ?? 0),
          status: item.urgency ?? "LOW",
        },
      };
    });
    const currentItemIds = new Set(
      items.map((i: any) => i.item_id).filter((v: any) => v != null)
    );
    (this.selectedData?.sprItems ?? [])
      .filter((original: any) => !currentItemIds.has(original.id))
      .forEach((original: any, idx: number) => {
        requests.push({
          id: items.length + idx,
          method: "DELETE",
          url: `/odata/PurchaseRequisitionItems(${original.id})`,
          headers: { "Content-Type": "application/json" },
        });
      });

    const batchPayload = { requests };

    this.commonService.post("$batch", batchPayload, true).subscribe({
      next: (res: any) => {
        if (isFinalApprove) {
          this.finalApproveRequisition(id);
          return;
        }

        this.afterSuccessSave();
      },
      error: (error: any) => {
        this.loading = false;
        this.toastService.show("error");
        console.error("Error occurred while saving:", error);
      },
    });
  }

  validateForm(targetStatus?: SprStatus): boolean {
    if (!this.selectedItem || this.selectedItem.length === 0) {
      this.warningMessage = $localize`Please select at least one item.`;

      this.isWarning = true;
      console.error("No items selected.");
      return false;
    }

    for (const item of this.selectedItem) {
      if (
        this.requisitionType === "SR" &&
        !this.isRequestMode() &&
        Number(item.stock ?? 0) <= 0
      ) {
        this.warningMessage = $localize`Current stock is 0 for "${item.product_name || item.item_code}". SR quantity cannot be requested.`;
        this.isWarning = true;
        return false;
      }

      if (!item.quantity || item.quantity <= 0) {
        this.warningMessage = $localize`Quantity must be greater than zero.`;
        this.isWarning = true;
        return false;
      }

      if (
        this.isRequestMode() &&
        targetStatus !== SprStatus.REJECTED &&
        (!item.approved_qty || item.approved_qty <= 0)
      ) {
        this.warningMessage = $localize`Approved quantity must be greater than zero.`;
        this.isWarning = true;
        return false;
      }

      if (item.stock < item.received_quantity) {
        this.warningMessage = $localize`Received quantity cannot exceed current stock.`;

        this.isWarning = true;
        console.error(
          `Received quantity cannot be greater than available stock for item: ${
            item.name || item.id
          }`
        );
        return false;
      }
    }

    return true;
  }

  CloseDialog() {
    this.open = false;
    this.currentStep = 1;
    this.srApprovalSteps = [];
    this.srApprovalStepsConfirmed = false;
  }

  currentStep = 1;

  // Per-person approval chain applies to both requisition types — SR uses the 'SR'
  // ApprovalType, SPR/Indent uses 'INDENT' (both seeded in ApprovalTypeSeeder).
  get approvalTypeCode(): string {
    return this.requisitionType === 'SR' ? 'SR' : 'INDENT';
  }

  get hasApprovalChain(): boolean {
    return this.requisitionType === 'SR' || this.requisitionType === 'SPR';
  }

  goToStep(step: number): void {
    const maxStep = this.hasApprovalChain ? 3 : 2;
    if (step < 1 || step > maxStep) return;
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

  getTodayFormatted(): string {
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, "0");
    const mm = String(today.getMonth() + 1).padStart(2, "0");
    const yyyy = today.getFullYear();
    return `${dd}-${mm}-${yyyy}`;
  }

  get todayFormatted(): string {
    return this.getTodayFormatted();
  }

  reset() {
    this.Spr = new PurchaseRequisition().deserialize({});
    this.Spr.required_by = this.getTodayFormatted();
    // Clear any previously-viewed SR's id carried over on this bound @Input — otherwise
    // a stale id here would let loadSrApprovalSteps()/canActOnSrApprovalStep read a past
    // request's approval-chain status while creating a brand-new SR.
    this.selectedData = null;
    this.currentStep = 1;
    this.departmentName = "";
    this.urgencyTitle = "";
    this.indentTypeTitle = "";
    this.itemAssosiate.bindingData = [];
    this.selectedItem = [];
    this.tableColum();
    this.syncDataWithGridTable();
    this.childComponentRef?.getGridApi()?.setGridOption("rowData", []);
    this.isReadOnly = false;

    if (this.hasApprovalChain) {
      this.loadSrApprovalSteps();
    }
  }

  newItem() {
    this.open = true;
    this.itemAssosiate.open = true;
    this.itemAssosiate.bindingData = this.selectedItem;
  }

  getDataFromAssosiate(event: any) {
    const result = (event as any[]).map((item) => {
      const existing = this.selectedItem.find((s) => s.id === item.id);
      if (existing) return existing;
      return {
        ...item,
        quantity: item.quantity ?? 1,
        approved_qty: item.approved_qty ?? item.quantity ?? 1,
        total_price:
          item.total_price ??
          Number(item.quantity ?? 1) * Number(item.unit_price ?? 0),
      };
    });
    this.populatedItem(result);
  }

  getDepartment(items: any) {
    const selectedItem = items.detail.item;
    if (selectedItem) {
      const dept = this.departments.find((d) => d.name === selectedItem.text);
      if (dept) {
        this.Spr.department_id = dept.id;
        this.departmentName = dept.name ?? '';
      }
    }
  }
  getUrgency(items: any) {
    const selectedItem = items.detail.item;
    if (selectedItem) {
      this.Spr.urgency = selectedItem.id;
      this.urgencyTitle = selectedItem.text;
    }
  }

  getIndentType(items: any) {
    const selectedItem = items.detail.item;
    if (selectedItem) {
      this.Spr.is_imported = selectedItem.id === 'FOREIGN';
      this.indentTypeTitle = selectedItem.text;
    }
  }

  populatedItem(data: any) {
    if (!Array.isArray(data)) return;
    this.tableColum();

    this.selectedItem = data.map((item: any) => {
      const stock = Number(item.current_stock ?? 0);
      const quantity =
        this.requisitionType === "SR"
          ? Math.min(Number(item.quantity ?? 1), stock)
          : Number(item.quantity ?? 1);
      return {
      item_code: item.item_code ?? "",
      product_name: item.product_name ?? "",
      quantity: quantity,
      approved_qty: item.approved_qty ?? item.quantity ?? 1,
      received_quantity: item.received_quantity ?? 0,
      unit_price: item.unit_price ?? 0,
      total_price:
        item.total_price ??
        Number(item.quantity ?? 1) * Number(item.unit_price ?? 0),
      stock: item.current_stock ?? 0,
      current_stock: item.current_stock ?? 0,
      currency: item.currency ?? "",
      uom: item.uom ?? "",
      id: item.id ?? null,
      item_id: item.item_id ?? null,
      };
    });

    this.syncDataWithGridTable();
    setTimeout(() => {
      const api = this.childComponentRef?.getGridApi();
      if (api) {
        api.ensureIndexVisible(0);
        api.sizeColumnsToFit();
      }
    });
  }

  getSprPopulated(data: any) {
    this.Spr.id = data.id;
    this.Spr.custom_id = data.custom_id;
    this.Spr.request_date = data.request_date;
    this.Spr.required_by = data.required_by;
    this.Spr.department_id = data.department_id;
    this.Spr.urgency = data.urgency;
    this.Spr.description = data.description;
    this.Spr.status = data.status;
    this.Spr.requested_by = data.requested_by;
    this.Spr.approved_by = data.approved_by;
    this.Spr.approved_at = data.approved_at;
    this.Spr.final_approved_by = data.final_approved_by;
    this.Spr.final_approved_at = data.final_approved_at;
    this.Spr.rejected_reason = data.rejected_reason;
    this.Spr.is_imported = data.is_imported ?? false;
    this.departmentName = data.department?.name ?? "";
    this.urgencyTitle = data.urgency ?? "";
    this.indentTypeTitle = this.Spr.is_imported ? $localize`Foreign` : $localize`Local`;
    this.tableColum();
    this.selectedItem = data.sprItems.map((item: any) => ({
      item_code: item.item.item_code ?? "",
      product_name: item.item.product_name ?? "",
      quantity: item.required_quantity ?? 1,
      approved_qty: item.approved_qty ?? item.required_quantity ?? 1,
      received_quantity: item.received_quantity ?? 0,
      unit_price: item.unit_price ?? 0,
      total_price:
        item.total_price ??
        Number(
          this.isRequestMode()
            ? item.approved_qty ?? item.required_quantity ?? 1
            : item.required_quantity ?? 1
        ) * Number(item.unit_price ?? 0),
      currency: item.item.currency ?? "",
      stock:
        this.Spr.status !== SprStatus.APPROVED
          ? item.item.current_stock ?? 0
          : item.previous_stock ?? 0,
      current_stock: item.current_stock ?? 0,
      uom: item.item.uom ?? "",
      id: item.item.id ?? null,
      item_id: item.id ?? null,
    }));
    this.syncDataWithGridTable();

    if (this.hasApprovalChain) {
      this.loadSrApprovalSteps();
    }
  }

  // Per-person approval checklist, driven by the ApprovalType(code='SR') assignment
  // built in base-data-management/approver-management. A SEPARATE, parallel checklist —
  // does not gate or affect SprStatus/the real Approve/Final-Approve workflow.
  //
  // Uses the REST `approval-types/by-code/{code}/approvers` lookup rather than an OData
  // `$filter=code eq '...'` — this app's Lodata schema discovery has proven to go stale
  // after a column is added to an already-discovered entity, so a plain Eloquent
  // lookup-by-code on the Backend is more robust for this frequently-called lookup.
  loadSrApprovalSteps() {
    this.srApprovalSteps = [];
    this.loadingSrApprovalSteps = true;
    this.srApprovalStepsConfirmed = false;
    const requisitionId = this.Spr.id;
    // `_=${Date.now()}` busts any intermediate caching (browser/proxy) that might ignore
    // the request's own Cache-Control: no-cache — this endpoint must always read fresh,
    // right after an approve/reject write.
    const cacheBust = `_=${Date.now()}`;
    const url = requisitionId
      ? `approval-types/by-code/${this.approvalTypeCode}/approvers?requisition_id=${requisitionId}&${cacheBust}`
      : `approval-types/by-code/${this.approvalTypeCode}/approvers?${cacheBust}`;

    this.commonService.get(url, false).subscribe({
      next: (res: any) => {
        const rows = (res?.data ?? []) as any[];
        const sorted = [...rows].sort(
          (a, b) => Number(a.pivot?.sequence_index ?? 0) - Number(b.pivot?.sequence_index ?? 0),
        );

        const currentEmployeeId = Number(localStorage.getItem('employee_id'));
        // The "current" step is the first one (in sequence_index order) not yet
        // approved — the chain halts there for display purposes whether it's still
        // pending or was rejected. Approve/Reject only ever act on this one step.
        const currentIndex = sorted.findIndex((row) => row.status !== 'approved');

        this.srApprovalSteps = sorted.map((row, index) => {
          const media = (row.media ?? [])[0];

          return {
            id: row.id,
            name: `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim(),
            designation: row.designation?.name ?? '',
            photoUrl: media ? `${environment.ServerApi}/storage/${media.id}/${media.file_name}` : '',
            isRequired: !!row.pivot?.is_required,
            status: (row.status ?? 'pending') as 'approved' | 'rejected' | 'pending',
            isCurrentUser: !!currentEmployeeId && row.id === currentEmployeeId,
            isCurrentStep: index === currentIndex,
          };
        });
        this.loadingSrApprovalSteps = false;
        this.srApprovalStepsConfirmed = true;
      },
      error: () => {
        this.srApprovalSteps = [];
        this.loadingSrApprovalSteps = false;
        this.srApprovalStepsConfirmed = false;
      },
    });
  }

  approveAsCurrentUser() {
    this.recordSrDecision('approve');
  }

  rejectAsCurrentUser() {
    this.recordSrDecision('reject');
  }

  private recordSrDecision(action: 'approve' | 'reject') {
    const requisitionId = this.Spr.id;
    if (!requisitionId || this.approvingSrStep) return;

    this.approvingSrStep = true;
    this.commonService.post(`requisitions/${requisitionId}/approver-${action}`, { code: this.approvalTypeCode }, false).subscribe({
      next: (res: any) => {
        this.approvingSrStep = false;
        // Once the last required approver approves (or anyone rejects), the Backend
        // finalizes the SR's real status too (SUBMITTED → APPROVED → FINAL_APPROVAL, or
        // → REJECTED) and locks further approve/reject calls — keep Spr.status in sync
        // here so the dialog reflects that without needing a full reopen.
        if (res?.requisition_status) {
          this.Spr.status = res.requisition_status;
        }
        this.loadSrApprovalSteps();
      },
      error: (err) => {
        this.approvingSrStep = false;
        this.toastService.show('error');
        if (err?.status === 409) {
          this.loadSrApprovalSteps();
        }
      },
    });
  }

  associateTableColum() {
    const columns = [
      {
        accessor: "item_code",
      },
      {
        accessor: "product_name",
      },
    ];
    return columns;
  }

  handleReadonly(data: any) {
    switch (data) {
      case "REQUEST":
        this.isReadOnly = true;
        break;
      case "APPROVED":
        this.isReadOnly = true;
        break;
      case "REJECTED":
        this.isReadOnly = true;
        break;
      default:
    }
    return this.isReadOnly;
  }

  isRequestMode() {
    return this.saveMode === saveMode.REQUEST || this.saveMode === "REQUEST";
  }

  shouldShowApprovedQtyColumn() {
    return this.isRequestMode() || (!this.showNewButton && this.Spr.status === SprStatus.APPROVED);
  }

  get primaryActionText() {
    return this.isRequestMode() ? $localize`Approve` : this.localization.Submit;
  }

  get canActOnSrApprovalStep(): boolean {
    if (!this.showApprovalActions) return false;

    // Never show Approve/Reject until the checklist has been freshly confirmed from the
    // server for THIS open of the dialog — otherwise a stale/default/empty pre-load state
    // could flash the buttons before the real per-request approval status is known.
    if (!this.srApprovalStepsConfirmed) return false;

    const requisitionId = this.Spr.id;
    if (!requisitionId) return false;

    return this.srApprovalSteps.some(
      (step) => step.isCurrentStep && step.isCurrentUser && step.status === 'pending',
    );
  }

  private get canActOnCurrentStatus() {
    // Both SR and SPR/Indent replaced the old 2-level GM/Store approve with the
    // per-person approval-chain checklist (`srApprovalSteps`/`canActOnSrApprovalStep`)
    // — showing both at once was a duplicate "approve" system.
    if (this.hasApprovalChain) {
      return false;
    }

    return (
      (this.Spr.status === SprStatus.SUBMITTED && this.canApprove) ||
      (this.Spr.status === SprStatus.APPROVED && this.canFinalApprove)
    );
  }

  get canShowPrimaryAction() {
    if (this.isReadOnly) return false;

    if (this.isRequestMode()) {
      return this.canActOnCurrentStatus;
    }

    return (
      this.Spr.status !== SprStatus.APPROVED &&
      this.Spr.status !== SprStatus.FINAL_APPROVAL &&
      this.Spr.status !== SprStatus.REJECTED
    );
  }

  get canShowRejectAction() {
    return this.isRequestMode() && this.canActOnCurrentStatus;
  }

  syncDataWithGridTable() {
    this.dataSource = { ...this.dataSource, data: [...this.selectedItem] };
  }

  variableValueChange() {}

  afterSuccessSave() {
    this.loading = false;
    this.toastService.show(this.ToastType);
    this.CloseDialog();
    this.saveEvent.emit();
    if (this.newSrData) {
      this.triggerSrNotification(this.newSrData);
      this.newSrData = null;
    }
    if (this.newSprData) {
      this.triggerSprNotification(this.newSprData);
      this.newSprData = null;
    }
    this.emitPendingSrActionNotification();
    this.emitPendingSprActionNotification();
  }

  private triggerSrNotification(sr: { id: number; custom_id?: string }): void {
    this.socketService.emit('store-requisition:created', {
      model_id: sr.id,
      model_custom_id: sr.custom_id ?? sr.id,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    });
  }

  private emitPendingSrActionNotification(): void {
    if (!this.pendingSrActionNotification) return;
    this.socketService.emit(this.pendingSrActionNotification.event, {
      model_id: this.pendingSrActionNotification.id,
      model_custom_id: this.pendingSrActionNotification.custom_id ?? this.pendingSrActionNotification.id,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    });
    this.pendingSrActionNotification = null;
  }

  private triggerSprNotification(spr: { id: number; custom_id?: string }): void {
    this.socketService.emit('store-spr:created', {
      model_id: spr.id,
      model_custom_id: spr.custom_id ?? spr.id,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    });
  }

  private emitPendingSprActionNotification(): void {
    if (!this.pendingSprActionNotification) return;
    this.socketService.emit(this.pendingSprActionNotification.event, {
      model_id: this.pendingSprActionNotification.id,
      model_custom_id: this.pendingSprActionNotification.custom_id ?? this.pendingSprActionNotification.id,
      sender_id: this.authUser.id,
      sender_name: this.authUser.name,
    });
    this.pendingSprActionNotification = null;
  }

  finalApproveRequisition(id: any) {
    this.commonService
      .put("store/requisitions-final-approve", { srId: id }, false)
      .subscribe({
        next: () => {
          this.afterSuccessSave();
        },
        error: (err: any) => {
          this.loading = false;
          this.toastService.show("error");
          console.error("Error during final approval:", err);
        },
      });
  }
}
