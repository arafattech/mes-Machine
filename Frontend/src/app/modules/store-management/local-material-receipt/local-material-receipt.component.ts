import { Component, OnInit, ViewChild } from "@angular/core";
import { CommonService } from "@app/services/common-service/common.service";
import { RolePermissionService } from "@app/services/role-permission-service/role-permission.service";
import { AgGridTableComponent } from "@app/shared/components/ag-grid-table/ag-grid-table.component";
import {
  AgGridTableColumn,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableDisplayConfig,
  AgGridTableToolbarActionEvent,
  AgGridToolbarFilter,
  GridTableColumnDataType,
} from "@app/shared/components/ag-grid-table/types/ag-grid-table.types";
import { DateFormatterService } from "@app/shared/utilities/date-format";
import { MRRFromComponent } from "@store-module/local-material-receipt/mrr-from/mrr-from.component";
import { ReceiveQtyFormComponent } from "@store-module/local-material-receipt/receive-qty-form/receive-qty-form.component";
import { Permissions } from "@app/shared/enums/permissions";

type MrrStatusFilter = "all" | "partial" | "completed" | "cancelled";

@Component({
  selector: "app-local-material-receipt",
  templateUrl: "./local-material-receipt.component.html",
  styleUrl: "./local-material-receipt.component.scss",
})
export class LocalMaterialReceiptComponent implements OnInit {
  @ViewChild("mrrLogGridRef") mrrLogGridRef?: AgGridTableComponent<any>;
  @ViewChild("MRRFrom") formRef!: MRRFromComponent;
  @ViewChild("receiveForm") receiveFormRef!: ReceiveQtyFormComponent;

  public saveMode = "POST";
  public selectedData: any;
  public permissions = Permissions;
  public loading = false;
  selectedMrr: any = null;
  mrrLogToolbarFilters: AgGridToolbarFilter[] = [];

  private static readonly EXPAND =
    "requestBy,department,supplier,purchaseOrder($expand=requisition,poItems($expand=item($expand=category,uom))),requisition($expand=sprItems($expand=item($expand=category,uom))),receiptItems($expand=item($expand=category,uom))";

  // ─── MRR selector bar ─────────────────────────────────────────────────────────

  public mrrOptions: any[] = [];
  public selectedMrrLabel = "";
  public statusFilter: MrrStatusFilter = "partial";
  private mrrSearchTimer: ReturnType<typeof setTimeout> | null = null;

  // ─── MRR Log ──────────────────────────────────────────────────────────────────

  private mrrLogAllRows: any[] = [];
  public selectedProductId: number | null = null;

  mrrLogDataSource: AgGridTableODataSourceConfig<any> = {
    type: "odata",
    endpoint: "MaterialReceiptLogs",
    staticData: true,
    data: [],
  };

  mrrLogToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`MRR Log`,
    showNewButton: true,
    addButtonText: $localize`Receive`,
    showSearch: true,
    showRowCount: true,
    showSegmentButton: false,
    showDownload: false,
  };

  mrrLogDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: "calc(100vh - 190px)",
    fillEmptyRows: false,
  };

  // ─── MRR Log summary tiles + left-panel item progress ────────────────────────

  // Every product on the selected MRR, straight from receiptItems/purchaseOrder.poItems —
  // available immediately (no log fetch needed), so a just-created MRR (zero receiving
  // events, zero logs) still lists all its products at 0% instead of showing nothing.
  // receiptItems can carry more than one row per product (syncReceiptItems appends a new
  // row per receive event) — take the latest (highest id) per product_id.
  get productProgressList(): any[] {
    if (!this.selectedMrr) return [];

    const poItemsById = new Map<number, any>();
    (this.selectedMrr.purchaseOrder?.poItems ?? []).forEach((poItem: any) => {
      poItemsById.set(Number(poItem.id), poItem);
    });

    const latestByProduct = new Map<number, any>();
    (this.selectedMrr.receiptItems ?? []).forEach((receiptItem: any) => {
      const productId = Number(receiptItem.product_id);
      const existing = latestByProduct.get(productId);
      if (!existing || Number(receiptItem.id) > Number(existing.id)) {
        latestByProduct.set(productId, receiptItem);
      }
    });

    return Array.from(latestByProduct.values()).map((receiptItem: any) => {
      const poItem = poItemsById.get(Number(receiptItem.po_item_id));
      return {
        product_id: Number(receiptItem.product_id),
        product: receiptItem.item,
        required_quantity: Number(poItem?.quantity ?? 0),
        received_quantity: Number(receiptItem.received_quantity ?? 0),
      };
    });
  }

  public productSearchTerm = "";

  onProductSearchInput(event: any): void {
    this.productSearchTerm = event?.target?.value ?? "";
  }

  get filteredProductProgressList(): any[] {
    const term = this.productSearchTerm.trim().toLowerCase();
    if (!term) return this.productProgressList;
    return this.productProgressList.filter((item) =>
      (item.product?.product_name ?? "").toLowerCase().includes(term),
    );
  }

  get selectedProductItem(): any | null {
    if (!this.selectedProductId) return null;
    return this.productProgressList.find((item) => Number(item.product_id) === this.selectedProductId) ?? null;
  }

  // Count of distinct calendar days on which the selected product had a receiving
  // event logged — "how many days it took to receive this product", not a quantity.
  get daysTakenToReceive(): number {
    if (!this.selectedProductId) return 0;
    const days = new Set(
      this.mrrLogAllRows
        .filter((row: any) => Number(row.product_id) === this.selectedProductId)
        .map((row: any) => new Date(row.created_at).toDateString()),
    );
    return days.size;
  }

  get totalReceivedQty(): number {
    return this.productProgressList.reduce((sum, item) => sum + Number(item.received_quantity ?? 0), 0);
  }

  get totalRequiredQty(): number {
    return this.productProgressList.reduce((sum, item) => sum + Number(item.required_quantity ?? 0), 0);
  }

  get totalDueQty(): number {
    return Math.max(0, this.totalRequiredQty - this.totalReceivedQty);
  }

  // productProgressList is a getter re-evaluated on every change-detection cycle, so it
  // returns a brand-new array of new objects on every click anywhere on the page — without
  // trackBy, *ngFor's default identity check sees "all new" and destroys/recreates every
  // card (and its ui5-progress-indicator) on each click, causing a visible re-render/flicker.
  trackByProductId(_index: number, item: any): number {
    return Number(item.product_id);
  }

  dueQty(item: any): number {
    return Math.max(0, Number(item.required_quantity ?? 0) - Number(item.received_quantity ?? 0));
  }

  progressPercent(item: any): number {
    const required = Number(item.required_quantity ?? 0);
    if (!required) return 0;
    return Math.min(100, Math.round((Number(item.received_quantity ?? 0) / required) * 100));
  }

  mrrLogColumns: AgGridTableColumn<any>[] = [
    {
      colId: "product_name",
      headerName: $localize`Product`,
      flex: 1,
      minWidth: 160,
      sortable: false,
      filter: false,
      floatingFilter: false,
      valueGetter: (p: any) => p.data?.product?.product_name ?? "",
    },
    {
      field: "required_quantity",
      headerName: $localize`Required Qty`,
      minWidth: 130,
      sortable: false,
      type: "numericColumn",
      filter: false,
      floatingFilter: false,
    },
    {
      field: "received_quantity",
      headerName: $localize`Received Qty`,
      minWidth: 130,
      sortable: false,
      type: "numericColumn",
      filter: false,
      floatingFilter: false,
    },
    {
      field: "receiving_quantity",
      headerName: $localize`Day Received`,
      minWidth: 130,
      sortable: false,
      type: "numericColumn",
      filter: false,
      floatingFilter: false,
    },
    {
      field: "created_at",
      headerName: $localize`Date`,
      minWidth: 160,
      sortable: false,
      filter: false,
      floatingFilter: false,
      dataType: GridTableColumnDataType.Date,
      valueFormatter: ({ value }: any) =>
        value
          ? this.dateFormatter.formatDate(value, true, false, false, false, false)
          : "",
    },
    {
      colId: "received_by_name",
      headerName: $localize`Received By`,
      minWidth: 130,
      sortable: false,
      filter: false,
      floatingFilter: false,
      valueGetter: (p: any) => p.data?.receivedBy?.name ?? "",
    },
    {
      field: "remark",
      headerName: $localize`Remark`,
      minWidth: 130,
      sortable: false,
      filter: false,
      floatingFilter: false,
    },
  ];

  constructor(
    private commonService: CommonService,
    public rolePermissionService: RolePermissionService,
    private dateFormatter: DateFormatterService,
  ) {}

  ngOnInit(): void {
    this.getMrrOptions();
  }

  private statusODataFilter(): string {
    if (this.statusFilter === "completed") return " and status eq 'COMPLETED'";
    if (this.statusFilter === "cancelled") return " and status eq 'CANCELLED'";
    if (this.statusFilter === "partial") return " and status eq 'PARTIAL'";
    return "";
  }

  getMrrOptions(search?: string): void {
    const term = search?.trim().toLowerCase();
    const searchFilter = term ? ` and contains(tolower(custom_id),'${term}')` : "";

    this.loading = true;
    this.commonService
      .get(
        `MaterialReceipts?$filter=source eq 'LOCAL'${this.statusODataFilter()}${searchFilter}` +
          `&$expand=${LocalMaterialReceiptComponent.EXPAND}&$orderby=custom_id desc&$top=50`,
        true,
      )
      .subscribe({
        next: (res: any) => {
          this.mrrOptions = res.value ?? [];
          if (term) {
            this.loading = false;
            return;
          }

          // Keep the reference fresh instead of leaving it pointed at a stale object —
          // productProgressList reads selectedMrr.receiptItems directly, so without this
          // the left panel/summary tiles kept showing pre-receive values until a full
          // page reload forced a brand-new selectedMrr object.
          if (this.selectedMrr) {
            const refreshed = this.mrrOptions.find((m) => Number(m.id) === Number(this.selectedMrr.id));
            if (refreshed) this.selectedMrr = refreshed;
            this.loading = false;
            return;
          }

          if (this.mrrOptions.length) {
            this.onMrrChange({ detail: { item: { id: this.mrrOptions[0].id, text: this.mrrOptions[0].custom_id } } });
          } else {
            this.loading = false;
          }
        },
        error: (err: any) => {
          console.error(err);
          this.loading = false;
        },
      });
  }

  onMrrSearchInput(event: any): void {
    const value = event?.target?.value ?? "";
    if (this.mrrSearchTimer) clearTimeout(this.mrrSearchTimer);
    this.mrrSearchTimer = setTimeout(() => this.getMrrOptions(value), 300);
  }

  onStatusFilterChange(status: MrrStatusFilter): void {
    this.statusFilter = status;
    this.selectedMrr = null;
    this.selectedMrrLabel = "";
    this.selectedProductId = null;
    this.mrrLogAllRows = [];
    this.mrrLogDataSource = { ...this.mrrLogDataSource, data: [] };
    this.getMrrOptions();
  }

  onMrrChange(event: any): void {
    const selectedItem = event?.detail?.item;
    if (!selectedItem) {
      this.selectedMrr = null;
      this.selectedMrrLabel = "";
      return;
    }

    const mrr = this.mrrOptions.find((m) => Number(m.id) === Number(selectedItem.id));
    if (!mrr) return;

    this.loading = true;
    this.selectedMrr = mrr;
    this.selectedMrrLabel = mrr.custom_id ?? "";
    this.mrrLogAllRows = [];
    this.mrrLogDataSource = { ...this.mrrLogDataSource, data: [] };
    this.mrrLogToolbarConfig = {
      ...this.mrrLogToolbarConfig,
      headerTitle: `${$localize`MRR Log`}: ${mrr.custom_id ?? ''}`,
    };

    const seen = new Set<number>();
    const productOptions = (mrr.receiptItems ?? [])
      .filter((ri: any) => ri.product_id && !seen.has(Number(ri.product_id)) && seen.add(Number(ri.product_id)))
      .map((ri: any) => ({ id: ri.product_id, label: ri.item?.product_name ?? String(ri.product_id) }));
    this.mrrLogToolbarFilters = productOptions.length
      ? [{ id: 'product', type: 'select', placeholder: $localize`Filter by Product`, clearLabel: $localize`All`, options: productOptions }]
      : [];

    // Auto-select the first product from the MRR's own items (available immediately,
    // independent of whether it has ever been received/logged) rather than waiting on
    // the log fetch — a just-created MRR has zero logs but should still show its products.
    const firstProduct = this.productProgressList[0];
    this.selectedProductId = firstProduct ? Number(firstProduct.product_id) : null;

    this.refreshMrrLog(mrr.id);
  }

  private refreshMrrLog(mrrId: number): void {
    this.commonService.get(`MaterialReceiptLogs?$filter=material_receipt_id eq ${mrrId}&$expand=product,receivedBy`).subscribe({
      next: (res: any) => {
        this.mrrLogAllRows = res.value ?? [];
        // Bake the filtered rows directly into this same dataSource assignment (not a
        // follow-up setGridOption call) so it isn't raced/overwritten by the grid's own
        // reload from the dataSource change.
        const rows = this.selectedProductId
          ? this.mrrLogAllRows.filter((r: any) => Number(r.product_id) === this.selectedProductId)
          : this.mrrLogAllRows;
        this.mrrLogDataSource = { ...this.mrrLogDataSource, data: rows };
        this.loading = false;
      },
      error: (err: any) => {
        console.error(err);
        this.loading = false;
      },
    });
  }

  selectProduct(productId: number): void {
    this.selectedProductId = Number(productId);
    const rows = this.mrrLogAllRows.filter((r: any) => Number(r.product_id) === this.selectedProductId);
    this.mrrLogGridRef?.getGridApi()?.setGridOption('rowData', rows);
  }

  onMrrLogToolbarAction(event: AgGridTableToolbarActionEvent): void {
    if (event.actionId !== 'filter:product') return;
    this.selectedProductId = event.value ? Number(event.value) : null;
    const rows = event.value
      ? this.mrrLogAllRows.filter((r: any) => String(r.product_id) === String(event.value))
      : this.mrrLogAllRows;
    this.mrrLogGridRef?.getGridApi()?.setGridOption('rowData', rows);
  }

  newItem(): void {
    this.formRef.readOnly = false;
    this.formRef.open = true;
    this.saveMode = "POST";
    this.formRef.reset();
    this.formRef.getCustomId();
  }

  viewItem(event: any): void {
    this.saveMode = "PUT";
    this.selectedData = event;
    this.formRef.readOnly = true;
    this.formRef.open = true;
    this.formRef.getReceiptPopulated(this.selectedData);
  }

  editMrr(event: any): void {
    if (!event?.id) return;
    this.saveMode = "PUT";
    this.selectedData = event;
    this.formRef.readOnly = event?.status === 'COMPLETED' || event?.status === 'CANCELLED';
    this.formRef.open = true;
    this.formRef.getReceiptPopulated(this.selectedData);
  }

  openReceiveDialog(): void {
    if (!this.selectedMrr || !this.selectedProductId) return;
    const item = this.productProgressList.find((row) => Number(row.product_id) === this.selectedProductId);
    if (!item) return;
    this.receiveFormRef.openFor(this.selectedMrr, item);
  }

  openPdf(row: any): void {
    this.commonService
      .post<Blob>(
        `store/material-receipts/${row.id}/pdf`,
        {},
        false,
        undefined,
        "blob"
      )
      .subscribe({
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
            link.download = `${row.custom_id ?? "material-receipt"}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
          setTimeout(() => URL.revokeObjectURL(pdfUrl), 100);
        },
      });
  }

  saveEvent(): void {
    const mrrId = this.selectedMrr?.id ?? this.selectedData?.id;
    this.getMrrOptions();
    if (mrrId) {
      this.refreshMrrLog(mrrId);
    } else {
      this.selectedMrr = null;
    }
  }
}
