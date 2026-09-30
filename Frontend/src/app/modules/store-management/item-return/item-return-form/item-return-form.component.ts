import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { ToastService } from "@app/services/toast-service/toast.service";
import { saveMode } from "@shared/enums/saveMode";
import { Localization } from "@shared/utilities/localization";
import { ValueState } from "@shared/utilities/value-state-wrapper";
import { ItemReturn } from "@shared/model/itemReturn";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";

@Component({
  selector: "app-item-return-form",
  templateUrl: "./item-return-form.component.html",
  styleUrl: "./item-return-form.component.scss",
})
export class ItemReturnFormComponent {
  @ViewChild("childComponentRef") childComponentRef!: AgGridTableComponent;
  @Input() saveMode = "POST";
  @Input() selectedData: any;
  @Output() saveEvent = new EventEmitter<any>();

  public open = false;
  public loading = false;
  public localization = Localization;
  public validationMessage = Localization.requiredField;
  public itemReturn = new ItemReturn().deserialize({});
  public valueStateOptions = { sr: ValueState.None };

  public departments: { id: number; name: string }[] = [];
  public issuedSrs: any[] = [];
  public returnLines: any[] = [];
  public selectedDepartmentLabel = "";
  public selectedSrLabel = "";
  public isDepartmentsLoading = false;
  public isSrsLoading = false;
  // Snapshot of whether this return was ALREADY approved when the dialog opened —
  // read this for readonly/disabled gating, not itemReturn.status (which approve()/
  // reject() mutate before saving, so checking status live would self-block the save).
  public alreadyApproved = false;

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

  constructor(
    private commonService: CommonService,
    private toastService: ToastService,
  ) {
    this.initDepartments();
    this.tableColumns();
  }

  isApproved(): boolean {
    return this.alreadyApproved;
  }

  tableColumns() {
    this.column = [
      { field: "item_code", headerName: $localize`Item Code`, minWidth: 140, editable: false },
      { field: "product_name", headerName: $localize`Name`, minWidth: 160, editable: false },
      {
        field: "required_quantity",
        headerName: $localize`SR Qty`,
        width: 110,
        type: "numericColumn",
        editable: false,
      },
      {
        field: "uom",
        headerName: $localize`Unit`,
        width: 100,
        editable: false,
      },
      {
        field: "previously_returned",
        headerName: $localize`Previously Returned`,
        width: 150,
        type: "numericColumn",
        editable: false,
      },
      {
        field: "remaining_quantity",
        headerName: $localize`Remaining Qty`,
        width: 130,
        type: "numericColumn",
        editable: false,
      },
      {
        field: "return_quantity",
        headerName: $localize`Return Qty`,
        width: 150,
        type: "numericColumn",
        editable: false,
        inlineEditor: {
          type: "stepInput",
          min: 0,
          maxField: "remaining_quantity",
          disabledWhenMaxZero: true,
          disabled: this.isApproved(),
        },
      },
    ];

    this.toolbarConfig = {
      headerTitle: $localize`Items`,
      showSearch: false,
      showRowCount: false,
      showDownload: false,
      showNewButton: false,
    };
  }

  initDepartments() {
    this.isDepartmentsLoading = true;
    this.commonService.get("Departments", true).subscribe({
      next: (res: any) => {
        this.departments = res.value ?? [];
        this.isDepartmentsLoading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.isDepartmentsLoading = false;
      },
    });
  }

  // Department picked → load that department's already-issued (FINAL_APPROVAL) SRs.
  onDepartmentChange(event: any) {
    const selectedItem = event?.detail?.item;
    this.issuedSrs = [];
    this.setReturnLines([]);
    this.selectedSrLabel = "";
    this.itemReturn.purchase_requisition_id = null;

    if (!selectedItem) {
      this.itemReturn.department_id = null;
      this.selectedDepartmentLabel = "";
      return;
    }
    this.itemReturn.department_id = Number(selectedItem.id);
    this.selectedDepartmentLabel = selectedItem.text ?? "";

    this.isSrsLoading = true;
    this.commonService
      .get(
        `PurchaseRequisitions?$expand=sprItems($expand=item($expand=uom))` +
          `&$filter=type eq 'SR' and status eq 'FINAL_APPROVAL' and department_id eq ${this.itemReturn.department_id}` +
          `&$orderby=id desc`,
        true,
      )
      .subscribe({
        next: (res: any) => {
          this.issuedSrs = res.value ?? [];
          this.isSrsLoading = false;
        },
        error: (err: any) => {
          console.error(err);
          this.isSrsLoading = false;
        },
      });
  }

  // Issued SR picked → build one return line per SR item, capped by received_quantity.
  onSrChange(event: any) {
    const selectedItem = event?.detail?.item;
    this.valueStateOptions.sr = ValueState.None;

    if (!selectedItem) {
      this.itemReturn.purchase_requisition_id = null;
      this.selectedSrLabel = "";
      this.setReturnLines([]);
      return;
    }
    this.itemReturn.purchase_requisition_id = Number(selectedItem.id);
    this.selectedSrLabel = selectedItem.text ?? "";

    const sr = this.issuedSrs.find((s) => s.id === this.itemReturn.purchase_requisition_id);
    this.setReturnLines(
      (sr?.sprItems ?? []).map((item: any) => {
        const requiredQuantity = item.required_quantity ?? 0;
        const previouslyReturned = item.return_quantity ?? 0;
        return {
          purchase_requisition_item_id: item.id,
          item_return_item_id: null,
          product_id: item.product_id ?? item.item?.id,
          item_code: item.item?.item_code ?? "",
          product_name: item.item?.product_name ?? "",
          required_quantity: requiredQuantity,
          uom: item.item?.uom?.name ?? "",
          received_quantity: item.received_quantity ?? 0,
          previously_returned: previouslyReturned,
          remaining_quantity: Math.max(0, requiredQuantity - previouslyReturned),
          return_quantity: 0,
        };
      }),
    );
  }

  private setReturnLines(lines: any[]) {
    this.returnLines = lines;
    this.dataSource = { ...this.dataSource, data: [...this.returnLines] };
  }

  async getCustomId() {
    const customId = await this.commonService.getCustomId({
      model: "item_returns",
      prefix: "IR",
      field: "custom_id",
    });
    this.itemReturn.custom_id = customId;
  }

  private todayDateString(): string {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  }

  reset() {
    this.itemReturn = new ItemReturn().deserialize({
      status: "PENDING",
      return_date: this.todayDateString(),
    });
    this.alreadyApproved = false;
    this.issuedSrs = [];
    this.selectedDepartmentLabel = "";
    this.selectedSrLabel = "";
    this.isSrsLoading = false;
    this.valueStateOptions = { sr: ValueState.None };
    this.setReturnLines([]);
    this.tableColumns();
  }

  newItemReturn() {
    this.reset();
    this.saveMode = saveMode.POST;
    this.getCustomId();
    this.open = true;
  }

  editItemReturn(data: any) {
    this.itemReturn = new ItemReturn().deserialize(data);
    this.alreadyApproved = data.status === "APPROVED";
    this.selectedDepartmentLabel = data.department?.name ?? "";
    this.selectedSrLabel = data.purchaseRequisition?.custom_id ?? "";
    // Only the current SR's saved lines are known on edit — keep them editable
    // without re-fetching the department's full issued-SR list.
    this.issuedSrs = data.purchaseRequisition ? [data.purchaseRequisition] : [];
    this.setReturnLines(
      (data.returnItems ?? []).map((line: any) => {
        // Previously-returned total already includes this line's own saved
        // return_quantity — add it back so "remaining" reflects pre-this-line state.
        const requiredQuantity = line.purchaseRequisitionItem?.required_quantity ?? 0;
        const previouslyReturned = line.purchaseRequisitionItem?.return_quantity ?? 0;
        const returnQuantity = line.return_quantity ?? 0;
        const previouslyReturnedExcludingThis = this.alreadyApproved
          ? Math.max(0, previouslyReturned - returnQuantity)
          : previouslyReturned;
        return {
          purchase_requisition_item_id: line.purchase_requisition_item_id,
          item_return_item_id: line.id,
          product_id: line.product_id,
          item_code: line.product?.item_code ?? "",
          product_name: line.product?.product_name ?? "",
          required_quantity: requiredQuantity,
          uom: line.product?.uom?.name ?? "",
          received_quantity: line.received_quantity ?? 0,
          previously_returned: previouslyReturnedExcludingThis,
          remaining_quantity: Math.max(0, requiredQuantity - previouslyReturnedExcludingThis),
          return_quantity: returnQuantity,
        };
      }),
    );
    this.saveMode = saveMode.PUT;
    this.valueStateOptions = { sr: ValueState.None };
    this.tableColumns();
    this.open = true;
  }

  validateForm(): boolean {
    if (this.isApproved()) {
      return false;
    }
    if (!this.itemReturn.purchase_requisition_id) {
      this.valueStateOptions.sr = ValueState.Negative;
      return false;
    }
    if (!this.returnLines.some((line) => (line.return_quantity ?? 0) > 0)) {
      return false;
    }
    return this.returnLines.every(
      (line) =>
        (line.return_quantity ?? 0) >= 0 &&
        (line.return_quantity ?? 0) <= line.remaining_quantity,
    );
  }

  submit() {
    this.itemReturn.status = "PENDING";
    this.save();
  }

  approve() {
    this.itemReturn.status = "APPROVED";
    this.save();
  }

  reject() {
    this.itemReturn.status = "REJECTED";
    this.save();
  }

  save() {
    if (!this.validateForm()) return;
    this.loading = true;
    this.childComponentRef?.stopEditing();

    const header$ =
      this.saveMode === saveMode.POST
        ? this.commonService.post("ItemReturns", this.itemReturn.toOdata(), true)
        : this.commonService.put(
            `ItemReturns(${this.itemReturn.id})`,
            this.itemReturn.toOdata(),
            true,
          );

    header$.subscribe({
      next: (res: any) => {
        const itemReturnId = this.itemReturn.id ?? res?.id;
        this.saveBatchRequest(itemReturnId);
      },
      error: (err: any) => {
        this.loading = false;
        this.toastService.show("error");
        console.error("Error saving item return", err);
      },
    });
  }

  private saveBatchRequest(itemReturnId: number) {
    const requests = this.returnLines
      .map((line, index) => {
        const hasQty = (line.return_quantity ?? 0) > 0;
        const isExisting = line.item_return_item_id != null;

        if (!hasQty && !isExisting) return null;

        if (!hasQty && isExisting) {
          return {
            id: index,
            method: "DELETE",
            url: `/odata/ItemReturnItems(${line.item_return_item_id})`,
            headers: { "Content-Type": "application/json" },
          };
        }

        return {
          id: index,
          method: isExisting ? "PUT" : "POST",
          url: isExisting
            ? `/odata/ItemReturnItems(${line.item_return_item_id})`
            : "/odata/ItemReturnItems",
          headers: { "Content-Type": "application/json" },
          body: {
            item_return_id: itemReturnId,
            purchase_requisition_item_id: line.purchase_requisition_item_id,
            product_id: line.product_id,
            received_quantity: line.received_quantity,
            return_quantity: line.return_quantity,
          },
        };
      })
      .filter(Boolean);

    if (!requests.length) {
      this.afterSuccessSave();
      return;
    }

    this.commonService.post("$batch", { requests }, true).subscribe({
      next: () => this.afterSuccessSave(),
      error: (err: any) => {
        this.loading = false;
        this.toastService.show("error");
        console.error("Error saving return items", err);
      },
    });
  }

  private afterSuccessSave() {
    this.loading = false;
    this.toastService.show(this.saveMode === saveMode.POST ? "add" : "edit");
    this.closeDialog();
    this.saveEvent.emit();
  }

  closeDialog() {
    this.open = false;
  }
}
