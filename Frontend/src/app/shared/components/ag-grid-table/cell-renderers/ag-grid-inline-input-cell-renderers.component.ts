import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
} from '@angular/core';
import { ICellRendererAngularComp } from 'ag-grid-angular';
import { ICellRendererParams } from 'ag-grid-community';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import {
  AgGridInlineEditorConfig,
  AgGridStepInputInlineConfig,
  AgGridTextInlineConfig,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import '@ui5/webcomponents/dist/StepInput.js';

// Always-on inline cell controls (rendered in every row, no click-to-edit).
// Replaces the React StepInput / Input cell renderers from custom-grid-table.

export interface AgGridInlineCellRendererParams<TData = any>
  extends ICellRendererParams<TData> {
  inlineConfig: AgGridInlineEditorConfig;
  field: string;
  onEdit?: (row: TData, field: string, newValue: any, oldValue: any) => void;
}

const readByPath = (obj: any, path: string): any =>
  path.split('.').reduce((acc: any, key: string) => acc?.[key], obj);

// ─── Step input (number with +/- stepper + border) ─────────────────────────────

@Component({
  selector: 'app-ag-grid-step-input-cell-renderer',
  standalone: true,
  imports: [CommonModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center h-full w-full">
      <ui5-step-input
        class="w-full"
        [value]="value"
        [min]="min"
        [max]="max"
        [step]="step"
        [disabled]="disabled"
        value-state="None"
        (keydown)="onKeyDown($event)"
        (change)="onChange($event)"
      ></ui5-step-input>
    </div>
  `,
})
export class AgGridStepInputCellRendererComponent
  implements ICellRendererAngularComp
{
  value = 0;
  min = 0;
  max: number | undefined;
  step = 1;
  disabled = false;

  private params!: AgGridInlineCellRendererParams;
  private field = '';

  constructor(private cdr: ChangeDetectorRef) {}

  agInit(params: AgGridInlineCellRendererParams): void {
    this.sync(params);
  }

  refresh(params: AgGridInlineCellRendererParams): boolean {
    this.sync(params);
    this.cdr.markForCheck();
    return true;
  }

  private sync(params: AgGridInlineCellRendererParams): void {
    this.params = params;
    this.field = params.field;
    const cfg = params.inlineConfig as AgGridStepInputInlineConfig;
    const data: any = params.data;

    this.min = cfg.min ?? 0;
    this.step = cfg.step ?? 1;
    this.max = cfg.maxField
      ? Number(readByPath(data, cfg.maxField) ?? 0)
      : cfg.max;
    this.disabled =
      !!cfg.disabled ||
      (!!cfg.disabledWhenMaxZero && this.max != null && this.max <= 0);
    this.value = Math.round(Number(readByPath(data, this.field) ?? 0));
  }

  onKeyDown(event: Event): void {
    event.stopPropagation();
  }

  onChange(event: Event): void {
    const target = event.target as any;
    let v = Math.round(Number(target?.value ?? 0));
    if (!Number.isFinite(v) || v < this.min) v = this.min;
    if (this.max != null && v > this.max) v = this.max;

    const data: any = this.params.data;
    const oldValue = data?.[this.field];
    if (data) data[this.field] = v;
    this.value = v;
    if (target) target.value = v;

    this.params.onEdit?.(data, this.field, v, oldValue);
    this.cdr.markForCheck();
  }
}

// ─── Text input (bordered, always visible) ──────────────────────────────────────

@Component({
  selector: 'app-ag-grid-inline-input-cell-renderer',
  standalone: true,
  imports: [CommonModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center h-full w-full">
      <ui5-input
        class="w-full"
        [value]="value"
        [disabled]="disabled"
        [placeholder]="placeholder"
        [maxlength]="maxLength"
        (keydown)="onKeyDown($event)"
        (input)="onInput($event)"
        (change)="onCommit($event)"
      ></ui5-input>
    </div>
  `,
})
export class AgGridInlineInputCellRendererComponent
  implements ICellRendererAngularComp
{
  value = '';
  placeholder = '';
  maxLength: number | undefined;
  disabled = false;

  private params!: AgGridInlineCellRendererParams;
  private field = '';
  private originalValue: any = '';

  constructor(private cdr: ChangeDetectorRef) {}

  agInit(params: AgGridInlineCellRendererParams): void {
    this.sync(params);
  }

  refresh(params: AgGridInlineCellRendererParams): boolean {
    this.sync(params);
    this.cdr.markForCheck();
    return true;
  }

  private sync(params: AgGridInlineCellRendererParams): void {
    this.params = params;
    this.field = params.field;
    const cfg = params.inlineConfig as AgGridTextInlineConfig;
    this.placeholder = cfg.placeholder ?? '';
    this.maxLength = cfg.maxLength;
    this.value = String(readByPath(params.data, this.field) ?? '');
    this.originalValue = this.value;
  }

  onKeyDown(event: Event): void {
    event.stopPropagation();
  }

  onInput(event: Event): void {
    const newValue = (event.target as any)?.value ?? '';
    this.value = newValue;
    const data: any = this.params.data;
    if (data) data[this.field] = newValue;
  }

  onCommit(event: Event): void {
    const newValue = (event.target as any)?.value ?? '';
    const data: any = this.params.data;
    if (data) data[this.field] = newValue;
    this.params.onEdit?.(data, this.field, newValue, this.originalValue);
    this.originalValue = newValue;
  }
}
