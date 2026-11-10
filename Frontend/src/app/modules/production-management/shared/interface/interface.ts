import {
  Accent,
  MetricColor,
  MetricIcon,
} from '@app/modules/production-management/shared/utils/types';

export interface SubItem {
  text: string;
  permission?: string;
  routerLink: string;
}

export interface MenuItem {
  text: string;
  icon: string;
  slot?: string;
  type?: string;
  expanded: boolean;
  permission?: string;
  routerLink?: string;
  subItems?: SubItem[];
}

export interface SidebarGroup {
  text: string;
  expanded: boolean;
  items: MenuItem[];
}

/** `type: 'overall'` is the fixed summary tile; any other value is a `machine_states.id` —
 * one tile per active state, not a fixed Active/Idle/Inactive/Maintenance/Fault set. */
export interface StatusCardData {
  percent: number;
  progress: number;
  counts?: number;
  label: string;
  type: 'overall' | number;
}

export interface Metric {
  label: string;
  /** `null` = not applicable (e.g. Quality for non-kg products); rendered as "n/a". */
  value: number | null;
  unit?: string;
  delta?: number;
  icon?: MetricIcon;
  color?: MetricColor;
}

/** Raw OEE inputs behind node-server `overview()`'s figures, so the page can advance
 * Availability / Performance / OEE every second between realtime pushes without polling.
 * `openStateProductive` is `null` when nothing is accruing (no open state, or the window
 * ended in the past) — then the figures are static. */
export interface OeeLiveInputs {
  activeSeconds: number;
  totalSeconds: number;
  openStateProductive: boolean | null;
  idealCycleSeconds: number | null;
  totalCount: number;
  goodCount: number;
  /** Quality denominator in kg; `null` when Quality is not applicable. */
  qualityTotal: number | null;
  /** How old the (possibly cached) snapshot was when served, measured on the server's clock —
   * the client extrapolates from `receivedAt - ageMs`, independent of clock skew. */
  ageMs: number;
}

/** Feeds `ProductionOverviewComponent`'s inputs 1:1. */
export interface ProductionSummary {
  periodLabel: string;
  productionTarget: number;
  productionAchieved: number;
  machineOk: number;
  machineTotal: number;
  wastage: number;
  unit: string;
}

/** Feeds the "Current Work Order / Shift" card — what's running on the machine right now. */
export interface CurrentWorkOrder {
  id: number;
  customId: string | null;
  productName: string | null;
  quantity: number;
  status: string | null;
}

export interface CurrentShift {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  color: string | null;
}

export interface CurrentWorkOrderShift {
  workOrder: CurrentWorkOrder | null;
  shift: CurrentShift | null;
}

/** One `GET production-logs` group (work order × shift × factory day), scoped to a single machine
 * by the `machine_id eq` filter shape. */
export interface MachineProductionLogRow {
  log_date: string;
  good_count: number;
  scrap_count: number;
  total_count: number;
  logged_at: string;
  work_order: { id: number; custom_id: string | null } | null;
  shift: { id: number; name: string } | null;
}

export interface PlannedMachine {
  id: number;
  machineName: string | null;
}

export interface WorkOrderDetailHeader {
  id: number;
  customId: string | null;
  productName: string | null;
  quantity: number;
  status: string | null;
  scheduledStart: string | null;
  actualStart: string | null;
  plannedMachines: PlannedMachine[];
}

export interface WorkOrderMachineBreakdownRow {
  machineId: number;
  machineName: string | null;
  shiftId: number | null;
  shiftName: string | null;
  shiftColor: string | null;
  goodCount: number;
  scrapCount: number;
  totalCount: number;
  startedAt: string | null;
  endedAt: string | null;
}

export interface WorkOrderDetail {
  workOrder: WorkOrderDetailHeader | null;
  machines: WorkOrderMachineBreakdownRow[];
  totals: {
    goodCount: number;
    scrapCount: number;
    totalCount: number;
    quantityTarget: number | null;
    percentComplete: number | null;
  };
  /** OEE scoped to this one work order (not a machine, not a date range) — see
   * node-server's `WorkOrderDetailService.computeOee()`. Empty array until at least
   * one machine has logged production against this WO. */
  oeeMetrics: Metric[];
  /** Same 4 OEE metrics, scoped down to one machine's own contribution to this work
   * order — keyed by `machine_id`. Missing/empty for a machine that hasn't logged
   * production against this WO yet. */
  oeeByMachine: Record<number, Metric[]>;
}

/** One wastage type available to log against a work order — the type picker's options in
 * `LogWastageComponent`, scoped to types actually assigned to at least one of the WO's machines. */
export interface EligibleWastageType {
  id: number;
  name: string;
}

export interface WastageLogEntryRow {
  wastageTypeId: number;
  wastageTypeName: string;
  qtyKg: number | null;
}

/** One machine's share of one wastage type's total within a `WorkOrderWastageDetail` — the
 * drill-down behind a `WastageTypeBreakdown` row. */
export interface WastageAllocationRow {
  machineId: number;
  machineName: string | null;
  allocatedQtyKg: number;
}

/** One wastage type's rollup within a work order (optionally narrowed to a shift/date) —
 * the "distributed by wastage type" + "overall per type per work order" report row. */
export interface WastageTypeBreakdown {
  wastageTypeId: number;
  wastageTypeName: string | null;
  totalQtyKg: number;
  percentOfTotal: number;
}

/** Feeds `WorkOrderDetailComponent`'s "Wastage" tab — node-server's
 * `GET /api/work-orders/{id}/wastage-detail`. */
export interface WorkOrderWastageDetail {
  totalQtyKg: number;
  byType: WastageTypeBreakdown[];
  allocationsByType: Record<number, WastageAllocationRow[]>;
}

/** A work order assigned to this machine (via `work_order_machines`) and still open —
 * the pick-list for manual production-count entry. */
export interface AssignedWorkOrder {
  id: number;
  customId: string | null;
  productName: string | null;
  quantity: number;
  status: string | null;
}

/** A product choice in a picker. */
export interface ProductOption {
  id: number;
  text: string;
}

export interface ShiftOption {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  color: string | null;
}

/** One row per (day × shift) in the selected date range — node-server's
 * `GET /api/machine/{id}/shift-breakdown`. `states` is dynamic, one entry per
 * `machine_states` row actually observed — not a fixed Active/Idle/Inactive/Maintenance set. */
export interface ShiftBreakdownRow {
  date: string;
  shiftId: number;
  shiftName: string;
  shiftColor: string | null;
  states: { machineStateId: number; name: string; color: string | null; hours: number }[];
  totalHours: number;
}

/** One row per machine assigned to the work order selected in `ProductionLogFormComponent`'s
 * "Log Production" tab — `goodCount` stays `null` until the operator types a value; rows left
 * `null` are skipped on submit (partial entry is expected, not every machine runs every shift). */
export interface ProductionLogEntryRow {
  machineId: number;
  machineName: string;
  goodCount: number | null;
}

export interface OverviewTile {
  title: string; // "Production Target"
  value: number; // 72000 or 72
  unit?: string; // "kg"
  icon?: 'target' | 'gear' | 'trophy' | 'bin';
  accent?: Accent; // background color theme
  variant?: 'value' | 'fraction';
  denom?: number; // for variant=fraction (e.g., 80)
  valueColor?: string; // tailwind class for value color (e.g., 'text-purple-700')
}

/** One machine-maintenance schedule row — OData `MachineMaintenanceSchedules`.
 * `activatedAt == null` + `endedAt == null` = SCHEDULED (future), `activatedAt`
 * set + `endedAt == null` = ACTIVE (override live), `endedAt` set = closed. */
export interface MachineMaintenanceSchedule {
  id: number;
  machineId: number;
  scheduledStartAt: string | null;
  reason: string | null;
  activatedAt: string | null;
  endedAt: string | null;
  endedBy: 'manual' | 'auto' | null;
  bufferEnabled: boolean;
  bufferMinutes: number;
}

/** One recurrence interval — REST `schedule-frequencies`. */
export interface ScheduleFrequency {
  id: number;
  name: string;
  interval_days: number;
  is_active: boolean;
}

/** Dropdown row — REST `schedule-frequencies/options`. */
export type ScheduleFrequencyOption = Pick<ScheduleFrequency, 'id' | 'name' | 'is_active'>;
