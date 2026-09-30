import { Component, EventEmitter, Output, ViewChild } from '@angular/core';
import { CommonService } from '@app/services/common-service/common.service';
import { ToastService } from '@app/services/toast-service/toast.service';
import { MachineOverviewDataService } from '@production-module/shared/services/machine-overview-data.service';
import { ProductionLogService } from '@production-module/shared/services/production-log.service';
import { ShiftOption, WastageLogEntryRow } from '@production-module/shared/interface/interface';
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
 * "Log Wastage" entry modal — pick a work order, shift, and date, enter a wastage quantity (kg) per
 * wastage type eligible for that work order, and submit.
 * Always additive, matching `ProductionLogFormComponent`'s audit-trail semantics.
 */
@Component({
  selector: 'app-log-wastage',
  templateUrl: './log-wastage.component.html',
})
export class LogWastageComponent {
  @ViewChild('entryGridRef')
  entryGridRef?: AgGridTableComponent<WastageLogEntryRow>;
  @Output() logged = new EventEmitter<void>();

  open = false;
  loading = false;
  submitting = false;

  workOrders: WorkOrderOption[] = [];
  shifts: ShiftOption[] = [];

  workOrderId: number | null = null;
  shiftId: number | null = null;
  date: string = this.today();

  entryRows: WastageLogEntryRow[] = [];
  readonly entryColumns: AgGridTableColumn<WastageLogEntryRow>[] = [
    {
      field: 'wastageTypeName',
      headerName: $localize`Wastage Type`,
      flex: 1,
      editable: false,
    },
    {
      field: 'qtyKg',
      headerName: $localize`Wastage (kg)`,
      width: 160,
      dataType: GridTableColumnDataType.NumberField,
      editable: true,
      minValue: 0,
    },
  ];
  entryDataSource: AgGridTableODataSourceConfig<WastageLogEntryRow> = {
    type: 'odata',
    endpoint: '',
    staticData: true,
    data: [],
  };
  readonly entryToolbarConfig: AgGridTableToolbarConfig = {
    headerTitle: $localize`Wastage Types`,
    showRowCount: true,
  };
  readonly entryDisplayConfig: AgGridTableDisplayConfig = {
    gridHeight: '340px',
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

  onWorkOrderChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.workOrderId = Number.isFinite(id) ? id : null;
    this.entryRows = [];

    if (this.workOrderId) {
      this.loadWorkOrderWastageTypes();
    } else {
      this.syncEntryGrid();
    }
  }

  onShiftChange(event: any): void {
    const id = Number(event?.detail?.item?.value);
    this.shiftId = Number.isFinite(id) ? id : null;
  }

  submit(): void {
    this.entryGridRef?.stopEditing();

    if (!this.workOrderId || !this.date) {
      this.toastService.show(
        'error',
        $localize`Select a work order and date first.`,
      );
      return;
    }

    const entries = this.entryRows
      .filter((row) => row.qtyKg != null && Number(row.qtyKg) > 0)
      .map((row) => ({
        wastageTypeId: row.wastageTypeId,
        qtyKg: Number(row.qtyKg),
      }));

    if (!entries.length) {
      this.toastService.show(
        'error',
        $localize`Enter a quantity (kg) for at least one wastage type.`,
      );
      return;
    }

    this.submitting = true;
    this.productionLogService
      .submitWastage(this.workOrderId, {
        date: this.date,
        shiftId: this.shiftId,
        entries,
      })
      .subscribe({
        next: () => {
          this.submitting = false;
          this.toastService.show('add');
          this.closeDialog();
          this.logged.emit();
        },
        error: (err) => {
          this.submitting = false;
          this.toastService.show(
            'error',
            err?.error?.message ?? undefined,
          );
        },
      });
  }

  private loadWorkOrderWastageTypes(): void {
    if (!this.workOrderId) return;

    this.loading = true;
    this.productionLogService
      .getEligibleWastageTypes(this.workOrderId)
      .subscribe({
        next: (types) => {
          this.entryRows = types.map((t) => ({
            wastageTypeId: t.id,
            wastageTypeName: t.name,
            qtyKg: null,
          }));
          this.syncEntryGrid();
          this.loading = false;
        },
        error: () => {
          this.loading = false;
        },
      });
  }

  private syncEntryGrid(): void {
    this.entryDataSource = {
      ...this.entryDataSource,
      data: [...this.entryRows],
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
      }>("WorkOrders?$filter=status ne 'cancelled'&$expand=product")
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
    this.syncEntryGrid();
  }

  private today(): string {
    return new Date().toISOString().slice(0, 10);
  }
}
