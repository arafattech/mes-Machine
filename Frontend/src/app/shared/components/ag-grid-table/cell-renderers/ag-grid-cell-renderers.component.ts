import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import {
  ICellRendererAngularComp,
  INoRowsOverlayAngularComp,
} from 'ag-grid-angular';
import { ICellRendererParams, INoRowsOverlayParams } from 'ag-grid-community';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import { AgGridTableRowAction } from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { statusStyles } from '@shared/utilities/statusStyles';
import '@ui5/webcomponents-fiori/dist/IllustratedMessage.js';
import '@ui5/webcomponents-fiori/dist/illustrations/NoData.js';

// ─── Tree cell renderer ───────────────────────────────────────────────────────

interface AgGridTreeCellRendererParams extends ICellRendererParams {
  onToggle: (groupId: string) => void;
  isExpanded: (groupId: string) => boolean;
}

@Component({
  selector: 'app-ag-grid-tree-cell-renderer',
  standalone: true,
  imports: [CommonModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center h-full gap-1 overflow-hidden">
      <ng-container *ngIf="isGroup; else leafTpl">
        <ui5-icon
          class="cursor-pointer flex-shrink-0"
          [name]="expanded ? 'navigation-down-arrow' : 'navigation-right-arrow'"
          style="width:1rem;height:1rem;color:var(--sapContent_IconColor,#0070f2);"
          (click)="onChevronClick($event)"
        ></ui5-icon>
        <span class="font-semibold truncate">{{ label }}</span>
      </ng-container>
      <ng-template #leafTpl>
        <span class="flex-shrink-0" style="width:1.5rem;display:inline-block;"></span>
        <span class="truncate">{{ label }}</span>
      </ng-template>
    </div>
  `,
})
export class AgGridTreeCellRendererComponent implements ICellRendererAngularComp {
  isGroup = false;
  expanded = false;
  label = '';
  private groupId = '';
  private onToggleFn!: (groupId: string) => void;
  private isExpandedFn!: (groupId: string) => boolean;

  constructor(private cdr: ChangeDetectorRef) {}

  agInit(params: AgGridTreeCellRendererParams): void {
    this.onToggleFn = params.onToggle;
    this.isExpandedFn = params.isExpanded;
    const d = params.data as any;
    this.isGroup = d?._level === 0;
    this.label = d?.name ?? '';
    this.groupId = String(d?.id ?? d?.name ?? '');
    this.expanded = this.isGroup ? this.isExpandedFn(this.groupId) : false;
  }

  refresh(_params: AgGridTreeCellRendererParams): boolean {
    this.expanded = this.isGroup ? this.isExpandedFn(this.groupId) : false;
    this.cdr.markForCheck();
    return true;
  }

  onChevronClick(e: Event): void {
    e.stopPropagation();
    this.onToggleFn(this.groupId);
    this.expanded = this.isExpandedFn(this.groupId);
    this.cdr.markForCheck();
  }
}

// ─── Tree tri-state checkbox cell renderer ──────────────────────────────────────

type TreeGroupState = 'checked' | 'indeterminate' | 'unchecked';

interface AgGridTreeCheckboxCellRendererParams extends ICellRendererParams {
  getGroupState: (groupId: string) => TreeGroupState;
  onGroupToggle: (groupId: string, checked: boolean) => void;
  onLeafToggle: (node: any, checked: boolean) => void;
  isDisabled?: (data: any) => boolean;
}

@Component({
  selector: 'app-ag-grid-tree-checkbox-cell-renderer',
  standalone: true,
  imports: [CommonModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center h-full">
      <ui5-checkbox
        [checked]="checked"
        [indeterminate]="indeterminate"
        [disabled]="disabled"
        (change)="onChange($event)"
      ></ui5-checkbox>
    </div>
  `,
})
export class AgGridTreeCheckboxCellRendererComponent implements ICellRendererAngularComp {
  checked = false;
  indeterminate = false;
  disabled = false;
  private isGroup = false;
  private groupId = '';
  private node!: any;
  private params!: AgGridTreeCheckboxCellRendererParams;

  constructor(private cdr: ChangeDetectorRef) {}

  agInit(params: AgGridTreeCheckboxCellRendererParams): void {
    this.params = params;
    this.sync(params);
  }

  refresh(params: AgGridTreeCheckboxCellRendererParams): boolean {
    this.params = params;
    this.sync(params);
    this.cdr.markForCheck();
    return true;
  }

  private sync(params: AgGridTreeCheckboxCellRendererParams): void {
    const d = params.data as any;
    this.node = params.node;
    this.isGroup = d?._level === 0;
    this.groupId = String(d?.id ?? d?.name ?? '');
    this.disabled = params.isDisabled ? params.isDisabled(d) : false;
    if (this.isGroup) {
      const state = params.getGroupState(this.groupId);
      // UI5 CheckBox renders the partial (dash) state only when checked is ALSO true.
      this.checked = state === 'checked' || state === 'indeterminate';
      this.indeterminate = state === 'indeterminate';
    } else {
      this.checked = !!params.node?.isSelected();
      this.indeterminate = false;
    }
  }

  onChange(e: Event): void {
    if (this.disabled) return;
    const checked = !!((e?.target as any)?.checked);
    if (this.isGroup) {
      // Clicking a partial (indeterminate) group selects all its children.
      this.params.onGroupToggle(this.groupId, this.indeterminate ? true : checked);
    } else {
      this.params.onLeafToggle(this.node, checked);
    }
  }
}

// ─── Icon + text cell renderer ────────────────────────────────────────────────

interface IconTextRendererParams extends ICellRendererParams {
  icon?: string;
  iconColor?: string;
}

@Component({
  selector: 'app-ag-grid-icon-text-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div style="display:flex;align-items:center;gap:0.4rem;height:100%">
      <ui5-icon *ngIf="icon" [name]="icon" [style.color]="iconColor"></ui5-icon>
      <span>{{ text }}</span>
    </div>
  `,
})
export class AgGridIconTextCellRendererComponent implements ICellRendererAngularComp {
  text = '';
  icon = '';
  iconColor = '';

  agInit(params: IconTextRendererParams): void {
    this.text = params.value ?? '';
    this.icon = params.icon ?? '';
    this.iconColor = params.iconColor ?? '';
  }

  refresh(params: IconTextRendererParams): boolean {
    this.text = params.value ?? '';
    return true;
  }
}

// ─── Action (Edit / Delete / Info + custom) cell renderer ───────────────────────

interface AgGridActionRendererParams<
  TData = any,
> extends ICellRendererParams<TData> {
  actions: AgGridTableRowAction<TData>[];
  onAction: (actionId: string, row: TData) => void;
}

@Component({
  selector: 'app-ag-grid-action-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <div class="flex items-center gap-[0.35rem] h-full">
      <ui5-button
        *ngFor="let action of visibleActions"
        class="ag-grid-action-cell__button"
        [design]="action.design || 'Transparent'"
        [icon]="action.icon || ''"
        [disabled]="isDisabled(action)"
        [attr.tooltip]="action.tooltip || action.label"
        (click)="triggerAction(action, $event)"
      >
        {{ action.label }}
      </ui5-button>
    </div>
  `,
  styleUrl: './ag-grid-cell-renderers.component.scss',
})
export class AgGridActionCellRendererComponent implements ICellRendererAngularComp {
  params!: AgGridActionRendererParams<any>;
  visibleActions: AgGridTableRowAction<any>[] = [];

  agInit(params: AgGridActionRendererParams<any>): void {
    this.params = params;
    this.refreshVisibleActions();
  }

  refresh(params: AgGridActionRendererParams<any>): boolean {
    this.params = params;
    this.refreshVisibleActions();
    return true;
  }

  triggerAction(action: AgGridTableRowAction<any>, event: Event): void {
    event.stopPropagation();
    this.params.onAction(action.id, this.params.data);
  }

  isDisabled(action: AgGridTableRowAction<any>): boolean {
    return action.disabled ? action.disabled(this.params.data) : false;
  }

  private refreshVisibleActions(): void {
    this.visibleActions = (this.params.actions || []).filter((action) =>
      action.visible ? action.visible(this.params.data) : true,
    );
  }
}

// ─── Radio-select cell renderer (e.g. "pick one row as the default") ──────────

interface AgGridRadioRendererParams<TData = any> extends ICellRendererParams<TData, boolean> {
  onSelect: (row: TData) => void;
}

@Component({
  selector: 'app-ag-grid-radio-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui5-radio-button
      [checked]="checked"
      (change)="onChange()"
    ></ui5-radio-button>
  `,
})
export class AgGridRadioCellRendererComponent implements ICellRendererAngularComp {
  params!: AgGridRadioRendererParams<any>;
  checked = false;

  constructor(private cdr: ChangeDetectorRef) {}

  agInit(params: AgGridRadioRendererParams<any>): void {
    this.params = params;
    this.checked = !!params.value;
  }

  refresh(params: AgGridRadioRendererParams<any>): boolean {
    this.params = params;
    this.checked = !!params.value;
    // OnPush + a plain field mutated from outside a template event (AG Grid calling
    // this method directly, not a DOM event) needs an explicit markForCheck — without
    // it the new `checked` value never reaches the DOM, even though the component's own
    // field is correctly updated (confirmed via direct inspection: Angular state true,
    // rendered ui5-radio-button.checked stayed false until this was added).
    this.cdr.markForCheck();
    return true;
  }

  onChange(): void {
    this.params.onSelect(this.params.data);
  }
}

// ─── Status badge cell renderer ───────────────────────────────────────────────

export interface AgGridStatusBadgeWarning {
  /** Short text — used as the icon tooltip and the popover header. */
  title: string;
  /** Label/value rows shown in the popover when the icon is clicked. */
  details: { label: string; value: string }[];
}

export interface AgGridStatusBadgeParams extends ICellRendererParams {
  /** Optional: return details to show a clickable warning icon after the badge (e.g. a manual status change). */
  warning?: (data: any) => AgGridStatusBadgeWarning | null;
}

@Component({
  selector: 'app-ag-grid-status-badge-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display:flex;align-items:center;gap:4px;height:100%">
      <span *ngIf="label" [style.background]="bg" [style.color]="color" style="padding:2px 10px;border-radius:8px;font-size:0.75rem;font-weight:600;white-space:nowrap;">
        {{ label }}
      </span>
      <ng-container *ngIf="warning">
        <ui5-icon #warningIcon name="alert" interactive [attr.title]="warning.title" [attr.accessible-name]="warning.title"
          style="width:0.875rem;height:0.875rem;cursor:pointer;color:var(--sapCriticalElementColor)"
          (click)="openWarning($event)"></ui5-icon>
        <ui5-popover [opener]="warningIcon" [open]="isWarningOpen" [attr.header-text]="warning.title"
          placement="Bottom" (close)="isWarningOpen = false">
          <div style="display:flex;flex-direction:column;gap:0.5rem;padding:0.5rem 0.25rem;min-width:14rem">
            <div *ngFor="let row of warningRows" style="display:flex;justify-content:space-between;align-items:center;gap:1.5rem">
              <ui5-label>{{ row.label }}</ui5-label>
              <span *ngIf="row.pill; else plainValue" [style.background]="row.pill.backgroundColor"
                style="padding:2px 10px;border-radius:8px;font-size:0.75rem;font-weight:600;white-space:nowrap;">
                {{ row.pill.label }}
              </span>
              <ng-template #plainValue><ui5-text style="font-weight:600">{{ row.value }}</ui5-text></ng-template>
            </div>
          </div>
        </ui5-popover>
      </ng-container>
    </div>
  `,
})
export class AgGridStatusBadgeComponent implements ICellRendererAngularComp {
  bg = 'rgba(172,172,172,0.3)';
  color = 'inherit';
  label = '';
  warning: AgGridStatusBadgeWarning | null = null;
  // Detail values that are a known status render as the same coloured pill as the badge.
  warningRows: { label: string; value: string; pill: { backgroundColor?: string; label: string } | null }[] = [];
  isWarningOpen = false;

  constructor(private cdr: ChangeDetectorRef) {}

  agInit(params: AgGridStatusBadgeParams): void {
    this.update(params);
  }

  refresh(params: AgGridStatusBadgeParams): boolean {
    this.update(params);
    this.cdr.markForCheck();
    return true;
  }

  // The icon sits inside a clickable row — keep the click from also selecting/opening the row.
  openWarning(event: Event): void {
    event.stopPropagation();
    this.isWarningOpen = true;
  }

  // An empty value renders no pill — columns that need a default (e.g. unpaid) pass it via valueGetter.
  private update(params: AgGridStatusBadgeParams): void {
    const value: string | null | undefined = params.value;
    this.warning = params.warning?.(params.data) ?? null;
    this.warningRows = (this.warning?.details ?? []).map((row) => {
      const pillStyle = statusStyles[row.value];
      return {
        ...row,
        pill: pillStyle
          ? { backgroundColor: pillStyle.backgroundColor, label: pillStyle.label ?? row.value }
          : null,
      };
    });
    const style = value ? statusStyles[value] : undefined;
    this.bg = style?.backgroundColor ?? 'rgba(172,172,172,0.3)';
    this.color = style?.color ?? 'inherit';
    this.label = style?.label ?? (value || '');
  }
}

// ─── Approval progress cell renderer ──────────────────────────────────────────

export interface AgGridApprovalProgressValue {
  approved: number;
  total: number;
}

@Component({
  selector: 'app-ag-grid-approval-progress-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div *ngIf="total > 0" class="flex items-center gap-1.5 w-full h-full">
      <div class="flex-1 h-1.5 rounded-full bg-gray-200 overflow-hidden">
        <div class="h-full" [style.width.%]="percent" [style.background]="barColor"></div>
      </div>
      <span class="text-[11px] text-slate-600 whitespace-nowrap">{{ approved }}/{{ total }}</span>
    </div>
  `,
})
export class AgGridApprovalProgressCellRendererComponent implements ICellRendererAngularComp {
  approved = 0;
  total = 0;
  percent = 0;
  barColor = '#F59E0B';

  constructor(private cdr: ChangeDetectorRef) {}

  agInit(params: ICellRendererParams<any, AgGridApprovalProgressValue | null>): void {
    this.update(params.value);
  }

  refresh(params: ICellRendererParams<any, AgGridApprovalProgressValue | null>): boolean {
    this.update(params.value);
    this.cdr.markForCheck();
    return true;
  }

  private update(value: AgGridApprovalProgressValue | null | undefined): void {
    this.approved = value?.approved ?? 0;
    this.total = value?.total ?? 0;
    this.percent = this.total > 0 ? Math.round((this.approved / this.total) * 100) : 0;
    this.barColor = this.approved >= this.total ? '#10B981' : '#F59E0B';
  }
}

// ─── Badge list cell renderer ─────────────────────────────────────────────────

const MAX_VISIBLE_BADGES = 2;

@Component({
  selector: 'app-ag-grid-badge-list-cell-renderer',
  standalone: true,
  imports: [CommonModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-wrap gap-1 items-center h-full py-0.5">
      <ui5-tag
        *ngFor="let label of displayed"
        design="Set2"
        color-scheme="5"
      >{{ label }}</ui5-tag>
      <ui5-tag
        *ngIf="overflow > 0"
        design="Set2"
        color-scheme="5"
      >+{{ overflow }}</ui5-tag>
    </div>
  `,
})
export class AgGridBadgeListCellRendererComponent implements ICellRendererAngularComp {
  displayed: string[] = [];
  overflow = 0;

  agInit(params: ICellRendererParams): void {
    this.setValues(params.value);
  }

  refresh(params: ICellRendererParams): boolean {
    this.setValues(params.value);
    return true;
  }

  private setValues(value: { name: string }[] | null | undefined): void {
    const list = Array.isArray(value) ? value : [];
    this.displayed = list.slice(0, MAX_VISIBLE_BADGES).map((r) => r.name);
    this.overflow = Math.max(list.length - MAX_VISIBLE_BADGES, 0);
  }
}

interface NoRowsOverlayParams {
  showIllustrated: boolean;
  illustratedName: string;
  title: string;
  subtitle: string;
  height: string;
  message: string;
  loadFailed: boolean;
  onRetry: () => void;
}

@Component({
  selector: 'app-ag-grid-no-rows-overlay',
  standalone: true,
  imports: [CommonModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ui5-illustrated-message
      *ngIf="p.loadFailed; else empty"
      name="UnableToLoad"
      design="Scene"
      [style.height]="p.height || 'calc(100vh - 160px)'"
    >
      <div slot="title" i18n>Unable to load data</div>
      <div slot="subtitle" i18n>The server could not be reached. Please try again.</div>
      <ui5-button design="Emphasized" (click)="p.onRetry()" i18n>Retry</ui5-button>
    </ui5-illustrated-message>
    <ng-template #empty>
    <ng-container *ngIf="p.showIllustrated; else plain">
      <ui5-illustrated-message
        [name]="p.illustratedName || 'NoData'"
        design="Scene"
        [style.height]="p.height || 'calc(100vh - 160px)'"
      >
        <div slot="title">{{ p.title }}</div>
        <div slot="subtitle">{{ p.subtitle }}</div>
      </ui5-illustrated-message>
    </ng-container>
    <ng-template #plain>
      <span class="ag-grid-table-no-rows">{{ p.message }}</span>
    </ng-template>
    </ng-template>
  `,
})
export class AgGridNoRowsOverlayComponent implements INoRowsOverlayAngularComp {
  p!: NoRowsOverlayParams;

  agInit(params: INoRowsOverlayParams & NoRowsOverlayParams): void {
    this.p = params;
  }

  refresh(params: INoRowsOverlayParams & NoRowsOverlayParams): void {
    this.p = params;
  }
}

// ─── Color badge cell renderer ────────────────────────────────────────────────

@Component({
  selector: 'app-ag-grid-color-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div style="display:flex;align-items:center;height:100%">
      <span [style.background]="color"
        style="display:inline-block;width:20px;height:20px;border-radius:50%;border:1px solid rgba(0,0,0,0.15);">
      </span>
    </div>
  `,
})
export class AgGridColorBadgeComponent implements ICellRendererAngularComp {
  color = '';

  agInit(params: ICellRendererParams): void { this.color = params.value ?? ''; }
  refresh(params: ICellRendererParams): boolean { this.color = params.value ?? ''; return true; }
}

// ─── Icon cell renderer (row-level icon, tinted by a sibling color field) ─────

@Component({
  selector: 'app-ag-grid-icon-cell-renderer',
  standalone: true,
  imports: [CommonModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <ui5-icon *ngIf="icon" [name]="icon" [style.color]="color"></ui5-icon>
  `,
})
export class AgGridIconCellRendererComponent implements ICellRendererAngularComp {
  icon = '';
  color = '';

  agInit(params: ICellRendererParams): void { this.update(params); }
  refresh(params: ICellRendererParams): boolean { this.update(params); return true; }

  private update(params: ICellRendererParams): void {
    this.icon = params.value ?? '';
    this.color = (params.data as { color?: string } | undefined)?.color ?? '';
  }
}

// ─── Dynamic-color status badge (label + row-driven color, e.g. shift color) ──

export interface AgGridDynamicColorBadgeParams extends ICellRendererParams {
  colorAccessor?: (data: any) => string | undefined | null;
}

@Component({
  selector: 'app-ag-grid-dynamic-color-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display:flex;align-items:center;height:100%">
      <span *ngIf="label" [style.background]="bg" [style.color]="color"
        style="padding:2px 10px;border-radius:8px;font-size:0.75rem;font-weight:600;white-space:nowrap;">
        {{ label }}
      </span>
    </div>
  `,
})
export class AgGridDynamicColorBadgeComponent implements ICellRendererAngularComp {
  bg = 'rgba(172,172,172,0.3)';
  color = 'inherit';
  label = '';

  agInit(params: AgGridDynamicColorBadgeParams): void { this.update(params); }
  refresh(params: AgGridDynamicColorBadgeParams): boolean { this.update(params); return true; }

  private update(params: AgGridDynamicColorBadgeParams): void {
    this.label = params.value ?? '';
    const shiftColor = params.colorAccessor?.(params.data);
    this.bg = shiftColor ? `${shiftColor}33` : 'rgba(172,172,172,0.3)';
    this.color = shiftColor ?? 'inherit';
  }
}

// ─── Qty stepper cell renderer ────────────────────────────────────────────────

interface AgGridQtyStepperParams extends ICellRendererParams {
  min?: number;
  max?: number;
  onChanged?: (row: any, newQty: number) => void;
}

@Component({
  selector: 'app-ag-grid-qty-stepper',
  standalone: true,
  imports: [CommonModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div style="display:flex;align-items:center;height:100%;gap:4px;">
      <ui5-button design="Transparent" icon="less" style="min-width:28px;height:24px;" (click)="decrement()"></ui5-button>
      <span style="min-width:32px;text-align:center;font-size:0.85rem;font-weight:600;">{{ qty }}</span>
      <ui5-button design="Transparent" icon="add" style="min-width:28px;height:24px;" (click)="increment()"></ui5-button>
    </div>
  `,
})
export class AgGridQtyStepperCellRendererComponent implements ICellRendererAngularComp {
  qty = 0;
  private min = 1;
  private max = 99999;
  private params!: AgGridQtyStepperParams;

  constructor(private cdr: ChangeDetectorRef) {}

  agInit(params: AgGridQtyStepperParams): void {
    this.params = params;
    this.qty = Number(params.value) || 0;
    if (params.min != null) this.min = params.min;
    if (params.max != null) this.max = params.max;
  }

  refresh(params: AgGridQtyStepperParams): boolean {
    this.qty = Number(params.value) || 0;
    this.cdr.markForCheck();
    return true;
  }

  increment(): void { this.apply(this.qty + 1); }
  decrement(): void { this.apply(this.qty - 1); }

  private apply(val: number): void {
    const next = Math.min(this.max, Math.max(this.min, val));
    if (next === this.qty) return;
    this.qty = next;
    this.params.node.setDataValue(this.params.column!.getColId(), next);
    this.params.onChanged?.(this.params.data, next);
    this.cdr.markForCheck();
  }
}
