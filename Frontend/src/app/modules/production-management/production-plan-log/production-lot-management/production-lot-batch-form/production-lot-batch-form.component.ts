import { Component, EventEmitter, Output } from '@angular/core';
import { Observable } from 'rxjs';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { Localization } from '@app/shared/utilities/localization';
import { ValueState } from '@app/shared/utilities/value-state-wrapper';
import { ProductionLot, ProductionLotCount, ProductionLotItem } from '@app/shared/model/productionLot';
import { LotStatus } from '@production-module/shared/enums/lot-status';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { ShiftOption } from '@production-module/shared/interface/interface';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';

interface OptionRow {
  id: number;
  text: string;
}

interface DraftCount {
  count_type_id: number | null;
  product_id: number | null;
}

interface CountUiState {
  qcRemark: string;
  bagDraftOpen: boolean;
  bagColumns: AgGridTableColumn<ProductionLotItem>[];
  bagDataSource: AgGridTableODataSourceConfig<ProductionLotItem>;
}

@Component({
  selector: 'app-production-lot-batch-form',
  templateUrl: './production-lot-batch-form.component.html',
})
export class ProductionLotBatchFormComponent {
  @Output() RefreshTable = new EventEmitter<void>();

  open = false;
  loading = false;
  saving = false;
  mode: 'create' | 'manage' = 'create';
  isReadOnly = false;
  selectedTab: 'details' | 'counts' = 'details';

  batch: ProductionLot = new ProductionLot().deserialize({});
  draftCounts: DraftCount[] = [{ count_type_id: null, product_id: null }];

  cancelConfirmOpen = false;
  cancelReason = '';
  private cancelTarget: ProductionLotCount | null = null;

  readonly bagToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Bags`,
    showRowCount: true,
  };

  readonly displayConfig: AgGridTableDisplayConfig = {
    gridHeight: '340px',
  };
  private countUi = new Map<number, CountUiState>();

  /** Chains bag mutations per count so a faster later save can't have its response
   * overwrite `batch` before an earlier still-in-flight save's response lands — see
   * runBagMutation. Keyed by count id. */
  private bagMutationChain = new Map<number, Promise<void>>();

  workOrders: (OptionRow & { productName: string | null })[] = [];
  machines: OptionRow[] = [];
  shifts: ShiftOption[] = [];
  products: OptionRow[] = [];
  countTypes: OptionRow[] = [];
  private optionsLoaded = false;

  public localization = Localization;
  public lotStatus = LotStatus;
  valueStateOptions = {
    machine: ValueState.None,
    lotDate: ValueState.None,
  };

  constructor(
    private readonly commonService: CommonService,
    private readonly toastService: ToastService,
    private readonly machineOverviewDataService: MachineOverviewDataService,
  ) {}

  openCreate(): void {
    this.mode = 'create';
    this.isReadOnly = false;
    this.batch = new ProductionLot().deserialize({ lot_date: this.today() });
    this.draftCounts = [{ count_type_id: null, product_id: null }];
    this.selectedTab = 'details';
    this.resetValueStates();
    this.open = true;
    this.loadOptions();
  }

  openManage(batch: ProductionLot, isReadOnly = false): void {
    this.mode = 'manage';
    this.isReadOnly = isReadOnly || this.isBatchTransferred(batch);
    this.selectedTab = 'details';
    this.resetValueStates();
    this.open = true;
    this.loadOptions();
    this.reloadBatch(batch.id!);
  }

  isBatchTransferred(batch?: ProductionLot): boolean {
    const counts = batch?.counts ?? this.batch?.counts ?? [];
    if (!counts.length) return false;
    const transferredStatuses: string[] = [
      LotStatus.PENDING_TRANSFER,
      LotStatus.RECEIVED,
      LotStatus.RECONCILED,
      'PENDING_TRANSFER',
      'RECEIVED',
      'RECONCILED',
    ];
    return counts.some((c) => transferredStatuses.includes(c?.status as string));
  }

  closeDialog(): void {
    this.open = false;
    this.saving = false;
  }

  onTabSelect(event: any): void {
    this.selectedTab = event.detail.tab.id;
  }

  onWorkOrderChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.batch.work_order_id = Number.isFinite(id) ? id : null;
  }

  onMachineChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.batch.machine_id = Number.isFinite(id) ? id : null;
    this.valueStateOptions.machine = ValueState.None;
  }

  onShiftChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.batch.shift_id = Number.isFinite(id) ? id : null;
  }

  onLotDateChange(): void {
    this.valueStateOptions.lotDate = this.batch.lot_date ? ValueState.None : ValueState.Negative;
  }

  get isHeaderEditable(): boolean {
    if (this.isReadOnly) return false;
    if (this.isBatchTransferred(this.batch)) return false;
    return this.mode === 'create' || (this.batch.counts ?? []).every((c) => c.status !== this.lotStatus.CANCELLED) === true;
  }

  // ui5-combobox only reflects [selected] on a cb-item inside the open dropdown list — the
  // closed box's own text needs an explicit [value], which these resolve from whichever
  // options list has already loaded (blank until then, same as the dropdown itself).
  get selectedWorkOrderText(): string {
    const wo = this.workOrders.find((w) => w.id === this.batch.work_order_id);
    return wo ? wo.text + (wo.productName ? ' · ' + wo.productName : '') : '';
  }

  get selectedMachineText(): string {
    return this.machines.find((m) => m.id === this.batch.machine_id)?.text ?? '';
  }

  get selectedShiftText(): string {
    return this.shifts.find((s) => s.id === this.batch.shift_id)?.name ?? '';
  }

  countTypeText(countTypeId: number | null): string {
    return this.countTypes.find((c) => c.id === countTypeId)?.text ?? '';
  }

  productText(productId: number | null): string {
    return this.products.find((p) => p.id === productId)?.text ?? '';
  }

  onDraftCountTypeChange(draft: DraftCount, event: any): void {
    const id = Number(event?.detail?.item?.value);
    draft.count_type_id = Number.isFinite(id) ? id : null;
  }

  onDraftProductChange(draft: DraftCount, event: any): void {
    const id = Number(event?.detail?.item?.value);
    draft.product_id = Number.isFinite(id) ? id : null;
  }

  addDraftCount(): void {
    this.draftCounts.push({ count_type_id: null, product_id: null });
  }

  removeDraftCount(index: number): void {
    this.draftCounts.splice(index, 1);
  }

  onSubmit(): void {
    if (this.selectedTab === 'details') {
      this.saveHeader(false);
    } else {
      this.saveHeader(true);
    }
  }

  saveHeader(closeAfterSave = false): void {
    if (!this.validateHeader()) return;

    this.saving = true;
    const request$ =
      this.mode === 'create'
        ? this.commonService.post<any>('production/lot-batches', this.batch.toCreatePayload(this.draftCounts), false)
        : this.commonService.put<any>(`production/lot-batches/${this.batch.id}`, this.batch.toPayload(), false);

    request$.subscribe({
      next: (res) => {
        this.saving = false;
        this.batch = new ProductionLot().deserialize(res);
        this.syncCountUi();
        this.toastService.show(this.mode === 'create' ? 'add' : 'edit');
        this.RefreshTable.emit();
        if (this.mode === 'create') {
          this.mode = 'manage';
          this.selectedTab = 'counts';
        }
        if (closeAfterSave) {
          this.closeDialog();
        }
      },
      error: (error) => {
        this.saving = false;
        this.toastService.show('error', error?.error?.message);
      },
    });
  }

  addCount(): void {
    this.commonService.post<any>(`production/lot-batches/${this.batch.id}/counts`, {}, false).subscribe({
      next: (res) => {
        this.batch = new ProductionLot().deserialize(res);
        this.syncCountUi();
        this.toastService.show('add');
      },
      error: (error) => this.toastService.show('error', error?.error?.message),
    });
  }

  onCountTypeChange(count: ProductionLotCount, event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.updateCount(count, { count_type_id: Number.isFinite(id) ? id : null, product_id: count.product_id });
  }

  onProductChange(count: ProductionLotCount, event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.updateCount(count, { count_type_id: count.count_type_id, product_id: Number.isFinite(id) ? id : null });
  }

  private updateCount(count: ProductionLotCount, payload: { count_type_id: number | null; product_id: number | null }): void {
    this.commonService.put<any>(`production/lot-batches/${this.batch.id}/counts/${count.id}`, payload, false).subscribe({
      next: (res) => {
        this.batch = new ProductionLot().deserialize(res);
        this.syncCountUi();
        this.toastService.show('edit');
      },
      error: (error) => this.toastService.show('error', error?.error?.message),
    });
  }

  isCountEditable(count: ProductionLotCount): boolean {
    if (this.isReadOnly) return false;
    return count.status === this.lotStatus.DOFFED;
  }

  addBagDraft(count: ProductionLotCount): void {
    this.countUiState(count).bagDraftOpen = true;
    this.syncCountUi();
  }

  canCancelCount(count: ProductionLotCount): boolean {
    if (this.isReadOnly) return false;
    return ![this.lotStatus.RECONCILED, this.lotStatus.CANCELLED].includes(count.status as LotStatus);
  }

  countUiState(count: ProductionLotCount): CountUiState {
    let state = this.countUi.get(count.id!);
    if (!state) {
      state = {
        qcRemark: count.qc_remark ?? '',
        bagDraftOpen: false,
        bagColumns: [],
        bagDataSource: { type: 'odata', endpoint: '', staticData: true, data: [] },
      };
      this.countUi.set(count.id!, state);
    }
    return state;
  }

  recordQc(count: ProductionLotCount, status: 'PASSED' | 'FAILED'): void {
    const state = this.countUiState(count);
    this.commonService
      .post<any>(`production/lot-batches/${this.batch.id}/counts/${count.id}/qc`, { qc_status: status, qc_remark: state.qcRemark || null }, false)
      .subscribe({
        next: (res) => {
          this.batch = new ProductionLot().deserialize(res);
          this.syncCountUi();
          this.toastService.show(status === 'PASSED' ? 'approve' : 'edit');
          this.RefreshTable.emit();
        },
        error: (error) => this.toastService.show('error', error?.error?.message),
      });
  }

  /** Fires on blur/commit of a bag-grid cell (see AgGridInline*CellRendererComponent) —
   * never per-keystroke. `row` is the exact item in the count's dataSource, already mutated
   * with `newValue` by the renderer before this runs. */
  onBagFieldChange(count: ProductionLotCount, row: ProductionLotItem, field: string, newValue: any): void {
    if (['bag_no', 'cone_count', 'gross_weight_kg', 'net_weight_kg'].includes(field)) {
      const parsed = newValue === '' || newValue == null ? null : Number(newValue);
      (row as any)[field] = Number.isFinite(parsed) ? parsed : null;
    }

    if (row.id) {
      this.persistBagUpdate(count, row);
    } else {
      this.maybePersistNewBag(count, row);
    }
  }

  deleteBag(count: ProductionLotCount, item: ProductionLotItem): void {
    if (!item.id) return;

    this.runBagMutation(
      count,
      this.commonService.delete<any>(`production/lot-batches/${this.batch.id}/counts/${count.id}/items/${item.id}`, null, false),
      'delete',
    );
  }

  private persistBagUpdate(count: ProductionLotCount, row: ProductionLotItem): void {
    this.runBagMutation(
      count,
      this.commonService.put<any>(`production/lot-batches/${this.batch.id}/counts/${count.id}/items/${row.id}`, this.bagPayload(row), false),
      'edit',
    );
  }

  private maybePersistNewBag(count: ProductionLotCount, row: ProductionLotItem): void {
    if (!row.cone_count || row.gross_weight_kg == null || row.net_weight_kg == null) {
      return; // still filling in required fields — nothing to save yet
    }

    this.runBagMutation(
      count,
      this.commonService.post<any>(`production/lot-batches/${this.batch.id}/counts/${count.id}/items`, this.bagPayload(row), false),
      'add',
      () => (this.countUiState(count).bagDraftOpen = false),
    );
  }

  /** Runs a bag-item mutation (add/edit/delete) chained after any earlier one still in
   * flight for the same count, so responses can never land out of order and clobber each
   * other's changes to `batch` — each save now only starts once the previous one's response
   * has already been applied. */
  private runBagMutation(count: ProductionLotCount, request$: Observable<any>, successToast: 'add' | 'edit' | 'delete', onSuccess?: () => void): void {
    const prior = this.bagMutationChain.get(count.id!) ?? Promise.resolve();

    const run = prior.then(
      () =>
        new Promise<void>((resolve) => {
          request$.subscribe({
            next: (res) => {
              this.batch = new ProductionLot().deserialize(res);
              onSuccess?.();
              this.syncCountUi();
              this.toastService.show(successToast);
              resolve();
            },
            error: (error) => {
              this.toastService.show('error', error?.error?.message);
              resolve();
            },
          });
        }),
    );

    this.bagMutationChain.set(count.id!, run);
  }

  private bagPayload(row: ProductionLotItem): Object {
    return {
      bag_no: row.bag_no ?? null,
      cone_count: row.cone_count,
      gross_weight_kg: row.gross_weight_kg,
      net_weight_kg: row.net_weight_kg,
      remark: row.remark ?? null,
    };
  }

  pack(count: ProductionLotCount): void {
    this.commonService.post<any>(`production/lot-batches/${this.batch.id}/counts/${count.id}/pack`, {}, false).subscribe({
      next: (res) => {
        this.batch = new ProductionLot().deserialize(res);
        this.syncCountUi();
        this.toastService.show('edit');
        this.RefreshTable.emit();
      },
      error: (error) => this.toastService.show('error', error?.error?.message),
    });
  }

  openCancelConfirm(count: ProductionLotCount): void {
    this.cancelTarget = count;
    this.cancelReason = '';
    this.cancelConfirmOpen = true;
  }

  closeCancelConfirm(): void {
    this.cancelConfirmOpen = false;
    this.cancelTarget = null;
  }

  confirmCancelCount(): void {
    if (!this.cancelTarget) return;
    const count = this.cancelTarget;
    this.cancelConfirmOpen = false;

    this.commonService
      .post<any>(`production/lot-batches/${this.batch.id}/counts/${count.id}/cancel`, { reason: this.cancelReason || null }, false)
      .subscribe({
        next: (res) => {
          this.batch = new ProductionLot().deserialize(res);
          this.syncCountUi();
          this.toastService.show('edit');
          this.RefreshTable.emit();
        },
        error: () => this.toastService.show('error'),
      });
  }

  private reloadBatch(id: number): void {
    this.loading = true;
    this.commonService
      .get<any>(
        `ProductionLots(${id})?$expand=machine,shift,workOrder,counts($expand=countType,product,items)`,
      )
      .subscribe({
        next: (res) => {
          this.batch = new ProductionLot().deserialize(res);
          if (this.isBatchTransferred(this.batch)) {
            this.isReadOnly = true;
          }
          this.syncCountUi();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
          this.toastService.show('error');
        },
      });
  }

  private validateHeader(): boolean {
    let isValid = true;
    if (!this.batch.machine_id) {
      this.valueStateOptions.machine = ValueState.Negative;
      isValid = false;
    }
    if (!this.batch.lot_date) {
      this.valueStateOptions.lotDate = ValueState.Negative;
      isValid = false;
    }
    return isValid;
  }

  private resetValueStates(): void {
    this.valueStateOptions = { machine: ValueState.None, lotDate: ValueState.None };
  }

  private loadOptions(): void {
    if (this.optionsLoaded) return;
    this.optionsLoaded = true;

    this.commonService
      .get<{ value: { id: number; custom_id: string | null; product?: { product_name: string } }[] }>(
        "WorkOrders?$filter=status eq 'in_progress'&$expand=product",
      )
      .subscribe((res) => {
        this.workOrders = (res.value ?? []).map((wo) => ({
          id: wo.id,
          text: wo.custom_id ?? `WO-${wo.id}`,
          productName: wo.product?.product_name ?? null,
        }));
      });

    // Lodata can't translate a machinegroups/any(...) lambda filter into valid SQL here
    // (confirmed: produces "AND )" and a MySQL syntax error) — same class of issue already
    // called out for WorkOrders' nav-path filters. Fetch with machinegroups expanded and
    // filter to Autoconers client-side instead.
    this.commonService
      .get<{ value: { id: number; machine_name: string; machinegroups?: { is_autocon: boolean }[] }[] }>(
        'Machines?$filter=is_active eq true&$expand=machinegroups',
      )
      .subscribe((res) => {
        this.machines = (res.value ?? [])
          .filter((m) => (m.machinegroups ?? []).some((g) => g.is_autocon))
          .map((m) => ({ id: m.id, text: m.machine_name }));
      });

    this.machineOverviewDataService.getActiveShifts().subscribe((shifts) => {
      this.shifts = shifts;
    });
    this.commonService
      .get<{ value: { id: number; product_name: string }[] }>(
        'Products?$filter=is_active eq true&$select=id,product_name',
      )
      .subscribe((res) => {
        this.products = (res.value ?? []).map((p) => ({ id: p.id, text: p.product_name }));
      });

    this.commonService
      .get<{ value: { id: number; name: string; prefix?: string }[] }>('CountTypes?$select=id,name,prefix')
      .subscribe((res) => {
        this.countTypes = (res.value ?? []).map((countType) => ({
          id: countType.id,
          text:
            countType.prefix && countType.prefix.trim()
              ? `${countType.name} (${countType.prefix.trim()})`
              : countType.name,
        }));
      });
  }

  private syncCountUi(): void {
    const liveIds = new Set((this.batch.counts ?? []).map((c) => c.id));
    for (const id of this.countUi.keys()) {
      if (!liveIds.has(id)) this.countUi.delete(id);
    }
    for (const id of this.bagMutationChain.keys()) {
      if (!liveIds.has(id)) this.bagMutationChain.delete(id);
    }

    for (const count of this.batch.counts ?? []) {
      const state = this.countUiState(count);
      state.qcRemark = count.qc_remark ?? state.qcRemark ?? '';

      const rows = [...(count.items ?? [])];
      if (this.isCountEditable(count) && state.bagDraftOpen) {
        // User-triggered draft row (see addBagDraft) — auto-generates bag_no as max(existing bag_no) + 1.
        const maxBagNo = (count.items ?? []).reduce((max, item) => Math.max(max, item.bag_no ?? 0), 0);
        const nextBagNo = maxBagNo > 0 ? maxBagNo + 1 : null;
        rows.push(new ProductionLotItem().deserialize({ bag_no: nextBagNo }));
      }
      state.bagDataSource = { ...state.bagDataSource, data: rows };
      state.bagColumns = this.buildBagColumns(count);
    }
  }

  private buildBagColumns(count: ProductionLotCount): AgGridTableColumn<ProductionLotItem>[] {
    const disabled = !this.isCountEditable(count);

    return [
      {
        field: 'bag_no',
        headerName: $localize`Bag No`,
        minWidth: 90,
        sortable: false,
        filter: false,
        ...(disabled
          ? {}
          : {
              inlineEditor: { type: 'stepInput', min: 1, disabled: false },
              afterValueChange: (row, field, newValue) => this.onBagFieldChange(count, row, field, newValue),
            }),
      },
      {
        field: 'cone_count',
        headerName: $localize`Cones`,
        minWidth: 130,
        sortable: false,
        filter: false,
        ...(disabled
          ? {}
          : {
              inlineEditor: { type: 'stepInput', min: 1, disabled: false },
              afterValueChange: (row, field, newValue) => this.onBagFieldChange(count, row, field, newValue),
            }),
      },
      {
        field: 'gross_weight_kg',
        headerName: $localize`Gross (kg)`,
        minWidth: 130,
        sortable: false,
        filter: false,
        ...(disabled
          ? {}
          : {
              inlineEditor: { type: 'input', placeholder: '0.00' },
              afterValueChange: (row, field, newValue) => this.onBagFieldChange(count, row, field, newValue),
            }),
      },
      {
        field: 'net_weight_kg',
        headerName: $localize`Net (kg)`,
        minWidth: 130,
        sortable: false,
        filter: false,
        ...(disabled
          ? {}
          : {
              inlineEditor: { type: 'input', placeholder: '0.00' },
              afterValueChange: (row, field, newValue) => this.onBagFieldChange(count, row, field, newValue),
            }),
      },
      {
        field: 'remark',
        headerName: $localize`Remark`,
        minWidth: 150,
        sortable: false,
        filter: false,
        ...(disabled
          ? {}
          : {
              inlineEditor: { type: 'input' },
              afterValueChange: (row, field, newValue) => this.onBagFieldChange(count, row, field, newValue),
            }),
      },
    ];
  }

  readonly lotSteps: { key: string; label: string }[] = [
    { key: 'DOFFED', label: $localize`Doffed` },
    { key: 'QC', label: $localize`QC` },
    { key: 'PACKED', label: $localize`Packed` },
    { key: 'PENDING_TRANSFER', label: $localize`Transferred` },
    { key: 'RECEIVED', label: $localize`Received` },
    { key: 'RECONCILED', label: $localize`Reconciled` },
  ];

  private readonly STEP_RANK: Record<string, number> = {
    PACKED: 2,
    PENDING_TRANSFER: 3,
    RECEIVED: 4,
    RECONCILED: 5,
  };

  isTerminalFailure(count: ProductionLotCount): boolean {
    return ['QC_FAILED', 'REJECTED', 'CANCELLED'].includes(count.status);
  }

  failureStepIndex(count: ProductionLotCount): number {
    if (count.status === 'QC_FAILED') return 1;
    if (count.status === 'REJECTED') return 3;
    // CANCELLED can happen from almost any prior state — best-effort guess at how far it got.
    if ((count.total_bags ?? 0) > 0) return 2;
    if (count.qc_status) return 1;
    return 0;
  }

  currentStepIndex(count: ProductionLotCount): number {
    const rank = this.STEP_RANK[count.status];
    if (rank !== undefined) return rank;
    if (count.qc_status === 'PASSED') return 1;
    return 0;
  }

  stepState(count: ProductionLotCount, index: number): 'done' | 'current' | 'pending' | 'failed' {
    if (this.isTerminalFailure(count)) {
      const failIndex = this.failureStepIndex(count);
      if (index === failIndex) return 'failed';
      return index < failIndex ? 'done' : 'pending';
    }

    const current = this.currentStepIndex(count);
    if (index < current) return 'done';
    if (index === current) return 'current';
    return 'pending';
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
