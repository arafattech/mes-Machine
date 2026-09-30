import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  OnDestroy,
} from '@angular/core';
import { IHeaderAngularComp } from 'ag-grid-angular';
import { IHeaderParams } from 'ag-grid-community';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import { Subject, takeUntil, filter } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import {
  AgGridTableColumn,
  AgGridTableFilterOption,
  AgGridTableFilterOptionInput,
} from '../types/ag-grid-table.types';
import { normalizeAgGridTableFilterOptions } from '../utils/ag-grid-table.filter-utils';

type FilterType = 'none' | 'text' | 'number' | 'singleSelect' | 'multiSelect';

type SelectAllState = 'none' | 'some' | 'all';

// Methods the grid component exposes via params.context (see AgGridTableComponent.gridContext).
interface AgGridHeaderContext {
  setColumnOdataFilter?: (colId: string, model: any) => void;
  toggleSelectAll?: (checked: boolean) => void;
  getSelectAllState?: () => SelectAllState;
  filterPopupOpened$?: Subject<string>;
}

// colId of the multi-selection checkbox column (mirrors AgGridTableComponent).
const SELECTION_COL_ID = '__selection__';

@Component({
  selector: 'app-ag-grid-custom-header',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Ui5MainModule],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './ag-grid-custom-header.component.html',
  styleUrl: './ag-grid-custom-header.component.scss',
})
export class AgGridCustomHeaderComponent
  implements IHeaderAngularComp, OnDestroy
{
  displayName = '';
  enableSort = false;
  sortState: 'asc' | 'desc' | null = null;

  filterType: FilterType = 'none';
  filterOptions: AgGridTableFilterOption[] = [];
  placeholder = '';
  textValue = '';
  multiSelected = new Set<string>();
  hasFilter = false;

  // Selection column: this header renders a select-all checkbox instead of title/sort/filter.
  isSelectAllHeader = false;
  selectAllState: SelectAllState = 'none';

  popupOpen = false;
  popupX = 0;
  popupY = 0;
  popupW = 220;

  private params!: IHeaderParams;
  private readonly destroy$ = new Subject<void>();
  private readonly textInput$ = new Subject<string>();
  private labelToValue = new Map<string, string>();

  // Stored (stable) handler refs so ngOnDestroy can detach them. The listeners live on
  // the grid api / column — both outlive this header — so leaving them attached leaks the
  // header instance and fires markForCheck() on a destroyed view after the column is
  // recreated (virtualization, column def change, grid teardown).
  private readonly onGridFilterChanged = (): void => {
    this.syncFromFilterModel();
    this.cdr.markForCheck();
  };
  private readonly onColumnSortChanged = (): void => {
    this.syncSortState();
    this.cdr.markForCheck();
  };
  private readonly onGridSelectionChanged = (): void => {
    this.syncSelectAllState();
    this.cdr.markForCheck();
  };

  constructor(
    private cdr: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>,
  ) {
    this.textInput$
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((v) => this.applyTextFilter(v));
  }

  agInit(params: IHeaderParams): void {
    this.params = params;
    this.displayName = params.displayName;
    this.isSelectAllHeader = params.column.getColId() === SELECTION_COL_ID;

    // Selection column → select-all checkbox only. Track selection + row-model changes so
    // the checkbox reflects current state (incl. blocks auto-selected on scroll).
    if (this.isSelectAllHeader) {
      this.syncSelectAllState();
      params.api.addEventListener('selectionChanged', this.onGridSelectionChanged);
      params.api.addEventListener('modelUpdated', this.onGridSelectionChanged);
      return;
    }

    this.enableSort = !!params.enableSorting;
    this.initFilter();
    this.syncSortState();
    this.syncFromFilterModel();
    params.api.addEventListener('filterChanged', this.onGridFilterChanged);
    params.column.addEventListener('sortChanged', this.onColumnSortChanged);

    const colId = params.column.getColId();
    this.headerContext?.filterPopupOpened$
      ?.pipe(filter((openedColId) => openedColId !== colId), takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.popupOpen) {
          this.popupOpen = false;
          this.cdr.markForCheck();
        }
      });
  }

  refresh(params: IHeaderParams): boolean {
    this.params = params;
    if (this.isSelectAllHeader) {
      this.syncSelectAllState();
      this.cdr.markForCheck();
      return true;
    }
    this.displayName = params.displayName;
    // Re-init when column def changes (e.g. category options loaded async)
    this.initFilter();
    this.syncSortState();
    this.cdr.markForCheck();
    return true;
  }

  ngOnDestroy(): void {
    this.params?.api?.removeEventListener('filterChanged', this.onGridFilterChanged);
    this.params?.column?.removeEventListener('sortChanged', this.onColumnSortChanged);
    this.params?.api?.removeEventListener('selectionChanged', this.onGridSelectionChanged);
    this.params?.api?.removeEventListener('modelUpdated', this.onGridSelectionChanged);
    this.destroy$.next();
    this.destroy$.complete();
  }

  onSort(event: Event): void {
    if (!this.enableSort) return;
    this.params.progressSort((event as MouseEvent).shiftKey);
  }

  stopProp(event: Event): void {
    event.stopPropagation();
  }

  // ─── Select-all (selection column) ────────────────────────────────────────
  // Toggling drives selection through the grid context: it selects every loaded row and the
  // grid keeps auto-selecting freshly-fetched blocks while active (no native cross-block
  // select-all in the Community Infinite Row Model).
  onSelectAllToggle(event: Event): void {
    const checked = !!(event.target as { checked?: boolean } | null)?.checked;
    this.headerContext?.toggleSelectAll?.(checked);
  }

  private syncSelectAllState(): void {
    this.selectAllState = this.headerContext?.getSelectAllState?.() ?? 'none';
  }

  private get headerContext(): AgGridHeaderContext | undefined {
    return this.params?.context as AgGridHeaderContext | undefined;
  }

  // ─── Popup ────────────────────────────────────────────────────────────────

  togglePopup(event: Event): void {
    event.stopPropagation();
    if (!this.popupOpen) {
      const rect = this.el.nativeElement.getBoundingClientRect();
      this.popupX = rect.left;
      this.popupY = rect.bottom + 2;
      this.popupW = Math.max(220, rect.width);
      this.headerContext?.filterPopupOpened$?.next(this.params.column.getColId());
    }
    this.popupOpen = !this.popupOpen;
    this.cdr.markForCheck();
  }

  closePopup(): void {
    this.popupOpen = false;
    this.cdr.markForCheck();
  }

  clearFilter(): void {
    this.clearInputState();
    if (this.filterType === 'multiSelect') {
      this.applyMultiSelectFilter(null);
    } else {
      void this.applyModel(null);
    }
  }

  // Close on outside click — but NOT on UI5 portal clicks (responsive-popover in body)
  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    if (!this.popupOpen) return;
    const inHost = this.el.nativeElement.contains(e.target as Node);
    const inUi5Portal = !!(e.target as Element)?.closest?.(
      'ui5-responsive-popover, ui5-popover, ui5-dialog, [ui5-popup-content]',
    );
    if (!inHost && !inUi5Portal) {
      this.popupOpen = false;
      this.cdr.markForCheck();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.popupOpen) this.closePopup();
  }

  // ─── Filter handlers ──────────────────────────────────────────────────────

  onTextInput(event: Event): void {
    const v = (event.target as HTMLInputElement).value;
    this.textValue = v;
    this.textInput$.next(v);
  }

  onNumberInput(event: Event): void {
    const raw = (event.target as HTMLInputElement).value;
    this.textValue = raw;
    const num = parseFloat(raw);
    void this.applyModel(
      raw && !isNaN(num)
        ? { filterType: 'number', type: 'equals', filter: num }
        : null,
    );
  }

  onSingleSelect(
    event: CustomEvent<{
      item?: { getAttribute: (a: string) => string | null };
    }>,
  ): void {
    const v = event?.detail?.item?.getAttribute('value') ?? '';
    this.textValue = this.filterOptions.find((o) => o.value === v)?.label ?? '';
    void this.applyModel(
      v ? { filterType: 'text', type: 'equals', filter: v } : null,
    );
  }

  onComboInput(value: string | null): void {
    if (!value) void this.applyModel(null);
  }

  // Pattern mirrors the working calender-management multi-combobox: read the selected
  // items straight off the event and pull each item's stamped `value` (the category id
  // set via [value]="opt.value") — no fragile label-text mapping. ngx may hand over the
  // native CustomEvent (event.detail.items) or the unwrapped detail (event.items) — accept
  // both. Keep values as STRINGS so they match opt.value in [selected]="multiSelected.has(...)".
  onMultiSelect(event: any): void {
    const items: any[] = event?.detail?.items ?? event?.items ?? [];
    const values = items
      .map((i) => i?.value ?? i?.id ?? this.labelToValue.get(i?.text ?? ''))
      .filter((v) => v !== null && v !== undefined && v !== '')
      .map((v) => String(v));
    this.multiSelected = new Set(values);
    this.applyMultiSelectFilter(
      values.length
        ? { filterType: 'text', type: 'in', filter: values.join('|') }
        : null,
    );
  }

  // multiSelect does NOT touch AG Grid's filter model. It hands the model straight to the
  // grid component via params.context, which builds the OData $filter fragment and reloads
  // the datasource. State lives here locally (multiSelected) — see syncFromFilterModel guard.
  private applyMultiSelectFilter(model: any): void {
    this.hasFilter = !!model;
    const colId = this.params.column.getColId();
    this.headerContext?.setColumnOdataFilter?.(colId, model);
    this.cdr.markForCheck();
  }

  // ─── Private ──────────────────────────────────────────────────────────────

  private initFilter(): void {
    const colDef = this.params.column.getColDef() as AgGridTableColumn;
    const fc = colDef.filterControl;

    if (fc?.type === 'singleSelect') {
      this.filterType = 'singleSelect';
      this.filterOptions = normalizeAgGridTableFilterOptions(
        fc.options as AgGridTableFilterOptionInput[],
      );
      this.placeholder = fc.placeholder ?? '';
      this.labelToValue.clear();
      this.filterOptions.forEach((o) =>
        this.labelToValue.set(o.label, o.value),
      );
      return;
    }
    if (fc?.type === 'multiSelect') {
      this.filterType = 'multiSelect';
      this.filterOptions = normalizeAgGridTableFilterOptions(
        fc.options as AgGridTableFilterOptionInput[],
      );
      this.placeholder = fc.placeholder ?? '';
      this.labelToValue.clear();
      this.filterOptions.forEach((o) =>
        this.labelToValue.set(o.label, o.value),
      );
      return;
    }
    if (colDef.filter === false || colDef.filter === undefined) {
      this.filterType = 'none';
      return;
    }
    if (colDef.filter === 'agNumberColumnFilter') {
      this.filterType = 'number';
      this.placeholder = '#';
      return;
    }
    this.filterType = 'text';
  }

  private syncSortState(): void {
    this.sortState = this.params.column.getSort() ?? null;
  }

  private syncFromFilterModel(): void {
    // multiSelect uses the direct-OData channel, not AG Grid's filter model. Its state is
    // owned locally — never let a filterChanged from another column reset it here.
    if (this.filterType === 'multiSelect') return;
    const model =
      this.params.api.getFilterModel()?.[this.params.column.getId()];
    this.hasFilter = !!model;
    if (!model) {
      this.clearInputState();
      return;
    }
    switch (this.filterType) {
      case 'text':
        this.textValue = model.filter ?? '';
        break;
      case 'number':
        this.textValue = model.filter != null ? String(model.filter) : '';
        break;
      case 'singleSelect':
        this.textValue =
          this.filterOptions.find((o) => o.value === model.filter)?.label ?? '';
        break;
    }
  }

  private clearInputState(): void {
    this.textValue = '';
    this.multiSelected = new Set();
    this.hasFilter = false;
  }

  private applyTextFilter(value: string): void {
    void this.applyModel(
      value ? { filterType: 'text', type: 'contains', filter: value } : null,
    );
  }

  // Used by text / number / dateRange / singleSelect filters — these still go through
  // AG Grid's filter model (getRows reads params.filterModel). multiSelect bypasses this.
  private async applyModel(model: any): Promise<void> {
    await this.params.api.setColumnFilterModel(this.params.column, model);
    this.params.api.onFilterChanged();
    // Explicit purge for Infinite Row Model — onFilterChanged alone may not trigger
    // getRows when called from UI5 event context (outside Angular's default zone
    // processing). No-op / absent for the client-side row model → optional call.
    this.params.api.purgeInfiniteCache?.();
    this.hasFilter = !!model;
    this.cdr.markForCheck();
  }
}
