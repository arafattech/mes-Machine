import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { ProductionLogService } from '@production-module/shared/services/production-log.service';
import {
  ProductionLogEntryRow,
  ShiftOption,
} from '@production-module/shared/interface/interface';
import { AgGridTableComponent } from '@shared/components/ag-grid-table/ag-grid-table.component';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';

interface WorkOrderOption {
  id: number;
  customId: string | null;
  productName: string | null;
}

/**
 * "Log Production" entry modal — pick a work order, shift, and date, enter a good count per
 * machine planned against that work order (partial entry is fine — blank rows are skipped),
 * and submit. Always additive: resubmitting for the same work order/machine/shift/date adds a
 * new `machine_production_counts` row rather than overwriting, matching the existing
 * per-machine flow's audit-trail semantics (`LogProductionEntryComponent`, `/mco`).
 *
 * The "History" tab shows every individual log row for the selected work order — deliberately
 * not `WorkOrderDetailComponent`'s grid, since that one aggregates/sums per machine+shift and
 * loses individual submissions. Backed by `GET work-orders/{id}/production-logs` (plain
 * Eloquent REST, not the `MachineProductionCounts` OData entity) — see `entryDataSource`'s
 * sibling comment on `ProductionLogListComponent` for why: combining `$expand` with
 * `$orderby`/`$count` silently drops the expanded machine/shift objects on that entity.
 */
@Component({
  selector: 'app-production-log-form',
  templateUrl: './production-log-form.component.html',
})
export class ProductionLogFormComponent {
  @ViewChild('entryGridRef')
  entryGridRef?: AgGridTableComponent<ProductionLogEntryRow>;
  @Output() RefreshTable = new EventEmitter<void>();

  open = false;
  loading = false;
  submitting = false;
  selectedTab: 'entry' | 'history' = 'entry';

  workOrders: WorkOrderOption[] = [];
  shifts: ShiftOption[] = [];

  workOrderId: number | null = null;
  shiftId: number | null = null;
  date: string = this.today();

  entryRows: ProductionLogEntryRow[] = [];
  readonly entryColumns: AgGridTableColumn<ProductionLogEntryRow>[] = [
    {
      field: 'machineName',
      headerName: $localize`Machine`,
      flex: 1,
      editable: false,
    },
    {
      field: 'goodCount',
      headerName: $localize`Good Count`,
      width: 160,
      dataType: GridTableColumnDataType.IntegerField,
      editable: true,
      minValue: 0,
    },
  ];
  entryDataSource: AgGridTableODataSourceConfig<ProductionLogEntryRow> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  readonly entryToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Machines`,
    showRowCount: true,
  };
  readonly entryDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '340px',
  };

  historyDataSource: AgGridTableODataSourceConfig<any> = {
    type: 'api',
    endpoint: '',
    customEndpoint: '',
    fromCustomPaginator: true,
    pageSize: 40,
  };
  readonly historyColumns: AgGridTableColumn<any>[] = [
    {
      colId: 'machine.machine_name',
      headerName: $localize`Machine`,
      minWidth: 160,
      sortable: false,
      filter: false,
      valueGetter: (p) => p.data?.machine?.machine_name ?? '',
    },
    {
      colId: 'shift.name',
      headerName: $localize`Shift`,
      minWidth: 120,
      sortable: false,
      filter: false,
      valueGetter: (p) => p.data?.shift?.name ?? '',
    },
    {
      field: 'bucket_started_at',
      headerName: $localize`Date`,
      minWidth: 140,
      sortable: false,
      filter: false,
      dataType: GridTableColumnDataType.Date,
    },
    {
      field: 'good_count',
      headerName: $localize`Good`,
      minWidth: 90,
      sortable: false,
      filter: false,
      dataType: GridTableColumnDataType.Number,
    },
    {
      field: 'scrap_count',
      headerName: $localize`Scrap`,
      minWidth: 90,
      sortable: false,
      filter: false,
      dataType: GridTableColumnDataType.Number,
    },
    {
      field: 'total_count',
      headerName: $localize`Total`,
      minWidth: 90,
      sortable: false,
      filter: false,
      dataType: GridTableColumnDataType.Number,
    },
    {
      field: 'created_at',
      headerName: $localize`Logged At`,
      minWidth: 160,
      sortable: false,
      filter: false,
      floatingFilter: false,
      valueFormatter: ({ value }: any) =>
        value ? new Date(value).toLocaleString() : '',
    },
  ];
  readonly historyToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`History`,
    showRowCount: true,
  };
  readonly historyDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '520px',
  };

  constructor(
    private readonly commonService: CommonService,
    private readonly machineOverviewDataService: MachineOverviewDataService,
    private readonly productionLogService: ProductionLogService,
    private readonly toastService: ToastService,
  ) {}

  openDialog(): void {
    this.open = true;
    this.resetForm();
    this.loadWorkOrders();
    this.machineOverviewDataService.getActiveShifts().subscribe((shifts) => {
      this.shifts = shifts;
    });
    this.syncEntryGrid();
  }

  closeDialog(): void {
    this.open = false;
  }

  onTabSelect(event: any): void {
    this.entryGridRef?.stopEditing();
    this.selectedTab = event.detail.tab.id;
  }

  onWorkOrderChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.workOrderId = Number.isFinite(id) ? id : null;
    this.entryRows = [];

    this.syncHistoryFilter();
    this.loadWorkOrderMachines();
  }

  onShiftChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.shiftId = Number.isFinite(id) ? id : null;
  }

  /**
   * Deliberately NOT bound to the Submit button's `[disabled]` — a cell mid-edit (typed but
   * not yet committed by AG Grid, e.g. before blur/Tab) wouldn't show up in `entryRows` yet,
   * so a purely reactive disable left the button permanently unclickable after typing into
   * the *last* interaction before Submit. `submit()` instead force-commits any in-progress
   * edit itself (`entryGridRef.stopEditing()`) before validating, and reports a specific
   * reason via toast rather than just doing nothing.
   */
  submit(): void {
    this.entryGridRef?.stopEditing();

    if (!this.workOrderId || !this.shiftId || !this.date) {
      this.toastService.show(
        'error',
        $localize`Select a work order, shift, and date first.`,
      );
      return;
    }

    const entries = this.entryRows
      .filter((row) => row.goodCount != null && row.goodCount >= 0)
      .map((row) => ({
        machineId: row.machineId,
        goodCount: row.goodCount as number,
      }));

    if (!entries.length) {
      this.toastService.show(
        'error',
        $localize`Enter a good count for at least one machine.`,
      );
      return;
    }

    this.submitting = true;
    this.productionLogService
      .submitProductionLog(this.workOrderId, {
        date: this.date,
        shiftId: this.shiftId!,
        entries,
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.toastService.show('add');
          this.RefreshTable.emit();
          this.closeDialog();
        },
        error: () => {
          this.submitting = false;
          this.toastService.show('error');
        },
      });
  }

  private loadWorkOrderMachines(): void {
    if (!this.workOrderId) return;

    this.loading = true;
    this.productionLogService
      .getWorkOrderMachines(this.workOrderId)
      .subscribe((rows) => {
        this.entryRows = rows;
        this.syncEntryGrid();
        this.loading = false;
      });
  }

  private syncEntryGrid(): void {
    this.entryDataSource = {
      ...this.entryDataSource,
      data: [...this.entryRows],
    };
  }

  private syncHistoryFilter(): void {
    this.historyDataSource = {
      ...this.historyDataSource,
      customEndpoint: this.workOrderId
        ? `work-orders/${this.workOrderId}/production-logs`
        : '',
    };
  }

  private loadWorkOrders(): void {
    this.commonService
      .get<{
        value: {
          id: number;
          custom_id: string | null;
          product?: { product_name: string };
        }[];
      }>("WorkOrders?$filter=status eq 'in_progress'&$expand=product")
      .subscribe({
        next: (res) => {
          this.workOrders = (res.value ?? []).map((wo) => ({
            id: wo.id,
            customId: wo.custom_id,
            productName: wo.product?.product_name ?? null,
          }));
        },
        error: () => this.toastService.show('error'),
      });
  }

  private resetForm(): void {
    this.workOrderId = null;
    this.shiftId = null;
    this.date = this.today();
    this.entryRows = [];
    this.selectedTab = 'entry';
    this.syncEntryGrid();
    this.syncHistoryFilter();
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
