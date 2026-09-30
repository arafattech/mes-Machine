import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ValueFormatterParams } from 'ag-grid-community';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { Metric, WastageAllocationRow, WorkOrderDetailHeader } from '@production-module/shared/interface/interface';
import {
  getWorkOrderStatusColor,
  getWorkOrderStatusLabel,
  getWorkOrderStatusTint,
} from '@production-module/shared/utils/work-order-status.util';
import {
  AgGridTableColumn,
  AgGridTableDisplayConfig,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  GridTableColumnDataType,
} from '@shared/components/ag-grid-table/types/ag-grid-table.types';

interface MachineShiftRow {
  shiftId: number | null;
  shiftName: string | null;
  goodCount: number;
  scrapCount: number;
  totalCount: number;
  startedAt: string | null;
  endedAt: string | null;
}

type MachineWastageRow = WastageAllocationRow & { wastageTypeName: string | null };

/**
 * This machine's own contribution to a work order — good/scrap counts and wastage
 * allocation, filtered down from the same work-order-wide data `WorkOrderDetailComponent`
 * fetches. Deliberately NOT the full cross-machine work order dashboard: that view moved to
 * `WorkOrderListComponent`'s info action (`<app-work-order-detail>` reused there unchanged).
 * This component answers "what did THIS machine do on this WO", not "how is the whole WO
 * doing" — the latter question belongs on the Work Orders list, not repeated on every
 * machine's own page.
 *
 * `oeeMetrics` is this machine's own Availability/Performance/Quality/Efficiency scoped to
 * this one WO — node-server's `WorkOrderDetailService.computeOee()` returns a per-machine
 * breakdown (`oee_by_machine`) alongside the WO-wide aggregate, so no new backend call is
 * needed here beyond the `getWorkOrderDetail()` this component already makes. Distinct from
 * this machine's date-range-windowed OEE on the Overview tab (`getOverview()`) — this one is
 * scoped to the WO's own engagement window, not a calendar range.
 */
@Component({
  selector: 'app-machine-work-order-overview',
  templateUrl: './machine-work-order-overview.component.html',
})
export class MachineWorkOrderOverviewComponent implements OnChanges {
  @Input() workOrderId: number | null = null;
  @Input() machineKey: string | null = null;

  readonly getWorkOrderStatusColor = getWorkOrderStatusColor;
  readonly getWorkOrderStatusTint = getWorkOrderStatusTint;
  readonly getWorkOrderStatusLabel = getWorkOrderStatusLabel;

  loading = false;
  workOrder: WorkOrderDetailHeader | null = null;
  woTotals: { goodCount: number; totalCount: number; quantityTarget: number | null; percentComplete: number | null } | null = null;

  oeeMetrics: Metric[] = [];

  machineShiftRows: MachineShiftRow[] = [];
  machineTotals = { goodCount: 0, scrapCount: 0, totalCount: 0 };

  wastageLoading = false;
  machineWastageRows: MachineWastageRow[] = [];
  machineWastageTotal = 0;

  get grandTotalKg(): number {
    const good = Number(this.machineTotals?.goodCount) || 0;
    const wastage = Number(this.machineWastageTotal) || 0;
    return good + wastage;
  }

  /** Shared by both grids — small (1-5 row) static-data lists, no search/toolbar needed. */
  readonly gridToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: 'Machine\'s Wastage',
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };
  readonly gridToolbarProductionConfig: AgGridTableToolbarConfig = {
    headerTitle: 'Machine\'s Production',
    showSearch: false,
    showRowCount: true,
    showSegmentButton: false,
    showNewButton: false,
  };
  readonly gridDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '420px',
  };
  readonly gridDisplayproductionConfig: AgGridTableDisplayConfig = {
    gridHeight: '420px',
  };
  
  readonly productionColumns: AgGridTableColumn<MachineShiftRow>[] = [
    {
      field: 'shiftName',
      headerName: $localize`Shift`,
      flex: 1,
      width:30,
      valueFormatter: (p: ValueFormatterParams<MachineShiftRow, string | null>) => p.value ?? $localize`—`,
    },
    { field: 'goodCount', headerName: $localize`Good`, dataType: GridTableColumnDataType.Number },
    { field: 'scrapCount', headerName: $localize`Scrap`, dataType: GridTableColumnDataType.Number },
    { field: 'totalCount', headerName: $localize`Total`, dataType: GridTableColumnDataType.Number },
    {
      field: 'endedAt',
      headerName: $localize`Last Logged`,
      valueFormatter: (p: ValueFormatterParams<MachineShiftRow, string | null>) =>
        p.value ? new Date(p.value).toLocaleString() : '',
    },
  ];

  productionDataSource: AgGridTableODataSourceConfig<MachineShiftRow> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  readonly machineWastageColumns: AgGridTableColumn<MachineWastageRow>[] = [
    {
      field: 'wastageTypeName',
      headerName: $localize`Wastage Type`,
      flex: 1,
      valueFormatter: (p: ValueFormatterParams<MachineWastageRow, string | null>) => p.value ?? $localize`—`,
    },
    {
      field: 'allocatedQtyKg',
      headerName: $localize`Allocated (kg)`,
      width: 190,
      dataType: GridTableColumnDataType.Number,
      valueFormatter: (p: ValueFormatterParams<MachineWastageRow, number>) => (p.value ?? 0).toFixed(2),
    },
  ];

  machineWastageDataSource: AgGridTableODataSourceConfig<MachineWastageRow> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };

  constructor(private readonly overviewDataService: MachineOverviewDataService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (!changes['workOrderId'] && !changes['machineKey']) return;
    this.refresh();
  }

  private refresh(): void {
    const machineId = this.machineKey ? Number(this.machineKey) : null;

    if (!this.workOrderId || !machineId) {
      this.workOrder = null;
      this.woTotals = null;
      this.oeeMetrics = [];
      this.machineShiftRows = [];
      this.machineTotals = { goodCount: 0, scrapCount: 0, totalCount: 0 };
      this.productionDataSource = { ...this.productionDataSource, data: [] };
      this.machineWastageRows = [];
      this.machineWastageTotal = 0;
      this.machineWastageDataSource = { ...this.machineWastageDataSource, data: [] };
      return;
    }

    this.loading = true;
    this.overviewDataService.getWorkOrderDetail(this.workOrderId).subscribe((detail) => {
      this.workOrder = detail.workOrder;
      this.woTotals = detail.totals;
      this.oeeMetrics = detail.oeeByMachine[machineId] ?? [];

      this.machineShiftRows = detail.machines
        .filter((row) => row.machineId === machineId)
        .map((row) => ({
          shiftId: row.shiftId,
          shiftName: row.shiftName,
          goodCount: row.goodCount,
          scrapCount: row.scrapCount,
          totalCount: row.totalCount,
          startedAt: row.startedAt,
          endedAt: row.endedAt,
        }));

      this.machineTotals = this.machineShiftRows.reduce(
        (acc, row) => ({
          goodCount: acc.goodCount + row.goodCount,
          scrapCount: acc.scrapCount + row.scrapCount,
          totalCount: acc.totalCount + row.totalCount,
        }),
        { goodCount: 0, scrapCount: 0, totalCount: 0 },
      );
      this.productionDataSource = { ...this.productionDataSource, data: this.machineShiftRows };

      this.loading = false;
    });

    this.wastageLoading = true;
    this.overviewDataService.getWorkOrderWastageDetail(this.workOrderId).subscribe((wastage) => {
      this.machineWastageRows = wastage.byType
        .map((type) => {
          const allocation = wastage.allocationsByType[type.wastageTypeId]?.find((a) => a.machineId === machineId);
          return allocation ? { ...allocation, wastageTypeName: type.wastageTypeName } : null;
        })
        .filter((row): row is MachineWastageRow => row !== null);

      this.machineWastageTotal = this.machineWastageRows.reduce((sum, row) => sum + row.allocatedQtyKg, 0);
      this.machineWastageDataSource = { ...this.machineWastageDataSource, data: this.machineWastageRows };
      this.wastageLoading = false;
    });
  }

  trackByMetricLabel = (_: number, m: Metric): string => m.label;
}
