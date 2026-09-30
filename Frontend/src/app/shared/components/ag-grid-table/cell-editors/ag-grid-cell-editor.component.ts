import {
  AfterViewInit,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ICellEditorAngularComp } from 'ag-grid-angular';
import { ICellEditorParams } from 'ag-grid-community';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import {
  AgGridTableColumn,
  AgGridTableEditorConfig,
  AgGridTableFilterOption,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';
import { normalizeAgGridTableFilterOptions } from '@app/shared/components/ag-grid-table/utils/ag-grid-table.filter-utils';

type EditorKind = AgGridTableEditorConfig['type'];

interface CellEditorParams extends ICellEditorParams {
  editorConfig?: AgGridTableEditorConfig;
}

const INPUT = 'border:2px solid #0066cc;border-radius:4px;font-size:13px;height:100%;outline:none;padding:0 8px;width:100%;box-sizing:border-box;';
const INPUT_RIGHT = INPUT + 'text-align:right;';
const TEXTAREA = 'border:2px solid #0066cc;border-radius:4px;font-family:inherit;font-size:13px;outline:none;padding:4px 8px;resize:vertical;width:100%;box-sizing:border-box;';

/**
 * Unified inline cell editor — replaces the per-type text / number / integer /
 * textarea / select / checkbox editors. The active control is chosen from
 * `editorConfig.type` (`AgGridTableEditorConfig`); `getValue()` parses per kind.
 * Wired via `AgGridTableComponent.resolveEditorColDef`.
 */
@Component({
  selector: 'app-ag-grid-cell-editor',
  standalone: true,
  imports: [CommonModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './ag-grid-cell-editor.component.html',
})
export class AgGridCellEditorComponent
  implements ICellEditorAngularComp, AfterViewInit
{
  @ViewChild('inputEl') inputEl?: ElementRef<HTMLInputElement | HTMLTextAreaElement>;

  // exposed style consts (template bindings)
  readonly INPUT = INPUT;
  readonly INPUT_RIGHT = INPUT_RIGHT;
  readonly TEXTAREA = TEXTAREA;

  kind: EditorKind = 'text';
  value: any = '';
  placeholder = '';
  maxLength: number | null = null;
  rows = 3;
  min: number | null = null;
  max: number | null = null;
  step = 'any';

  // select-only
  options: AgGridTableFilterOption[] = [];
  displayValue = '';

  private params!: CellEditorParams;
  private originalValue: any;
  private afterValueChangeFn?: (row: any, field: string, newVal: any, oldVal: any) => void;

  agInit(params: CellEditorParams): void {
    this.params = params;
    this.originalValue = params.value;
    this.afterValueChangeFn = (params.colDef as AgGridTableColumn)?.afterValueChange;

    const cfg = params.editorConfig;
    this.kind = cfg?.type ?? 'text';

    switch (this.kind) {
      case 'checkbox':
        this.value = !!params.value;
        break;

      case 'select': {
        const sel = cfg as Extract<AgGridTableEditorConfig, { type: 'select' }>;
        this.value = params.value;
        this.placeholder = sel?.placeholder ?? 'Select...';
        this.options = normalizeAgGridTableFilterOptions(sel?.options);
        this.displayValue =
          this.options.find((o) => o.value === String(params.value ?? ''))?.label ??
          String(params.value ?? '');
        break;
      }

      case 'number': {
        const n = cfg as Extract<AgGridTableEditorConfig, { type: 'number' }>;
        this.value = params.value ?? '';
        this.min = n?.min ?? null;
        this.max = n?.max ?? null;
        this.placeholder = n?.placeholder ?? '';
        if (n?.decimals !== undefined && n.decimals > 0) {
          this.step = String(1 / Math.pow(10, n.decimals));
        }
        break;
      }

      case 'integer': {
        const i = cfg as Extract<AgGridTableEditorConfig, { type: 'integer' }>;
        this.value = params.value ?? '';
        this.min = i?.min ?? null;
        this.max = i?.max ?? null;
        break;
      }

      case 'textarea': {
        const t = cfg as Extract<AgGridTableEditorConfig, { type: 'textarea' }>;
        this.value = params.value ?? '';
        this.rows = t?.rows ?? 3;
        this.placeholder = t?.placeholder ?? '';
        this.maxLength = t?.maxLength ?? null;
        break;
      }

      default: {
        const tx = cfg as Extract<AgGridTableEditorConfig, { type: 'text' }>;
        this.value = params.value ?? '';
        this.placeholder = tx?.placeholder ?? '';
        this.maxLength = tx?.maxLength ?? null;
      }
    }
  }

  ngAfterViewInit(): void {
    if (this.kind === 'select' || this.kind === 'checkbox') return;
    setTimeout(() => {
      const el = this.inputEl?.nativeElement;
      el?.focus();
      // text/number/integer pre-select the content; textarea places cursor only
      if (this.kind !== 'textarea') (el as HTMLInputElement | undefined)?.select?.();
    });
  }

  getValue(): any {
    const result = this.parse();
    if (result !== this.originalValue && this.afterValueChangeFn) {
      this.afterValueChangeFn(
        this.params.data,
        this.params.column.getColId(),
        result,
        this.originalValue,
      );
    }
    return result;
  }

  // Allow editing to start even on falsy/empty cell values (textarea, checkbox).
  isCancelBeforeStart(): boolean {
    return false;
  }

  onInput(event: Event): void {
    this.value = (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  onKeyDown(event: KeyboardEvent): void {
    // Textarea keeps Escape (cancel) + Tab (commit) flowing to AG Grid; every
    // other control swallows all keys so the grid never hijacks typing.
    if (this.kind === 'textarea' && (event.key === 'Escape' || event.key === 'Tab')) {
      return;
    }
    event.stopPropagation();
  }

  handleSelect(value: string): void {
    this.value = value;
    this.displayValue = this.options.find((o) => o.value === value)?.label ?? value;
  }

  toggle(): void {
    this.value = !this.value;
    // Auto-commit on toggle — consistent with checkbox UX
    setTimeout(() => this.params.api.stopEditing());
  }

  private parse(): any {
    switch (this.kind) {
      case 'number': {
        const p = parseFloat(String(this.value));
        return isNaN(p) ? null : p;
      }
      case 'integer': {
        const raw = String(this.value).trim();
        if (raw === '') return null;
        const p = Math.round(parseFloat(raw));
        return isNaN(p) ? null : p;
      }
      case 'checkbox':
        return !!this.value;
      default:
        // text / textarea / select
        return this.value;
    }
  }
}
