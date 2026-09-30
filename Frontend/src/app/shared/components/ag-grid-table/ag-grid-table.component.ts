import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  EventEmitter,
  HostBinding,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  CdkDragDrop,
  DragDropModule,
  moveItemInArray,
} from '@angular/cdk/drag-drop';
import { CommonService } from '@app/services/common-service/common.service';
import {
  AllCommunityModule,
  BodyScrollEvent,
  CellValueChangedEvent,
  ColDef,
  ColumnMovedEvent,
  ColumnState,
  ColumnVisibleEvent,
  DataTypeDefinition,
  FilterChangedEvent,
  GetRowIdParams,
  GridApi,
  GridReadyEvent,
  ModuleRegistry,
  RowClassParams,
  RowClickedEvent,
  RowHeightParams,
  RowModelType,
  SelectionChangedEvent,
  SortChangedEvent,
  colorSchemeDark,
  themeQuartz,
} from 'ag-grid-community';
import { AgGridAngular } from 'ag-grid-angular';
import { Ui5MainModule } from '@ui5/webcomponents-ngx';
import { HttpParams } from '@angular/common/http';
import { Subject, firstValueFrom, merge, takeUntil } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import moment from 'moment';

import { AgGridCustomHeaderComponent } from '@app/shared/components/ag-grid-table/headers/ag-grid-custom-header.component';
import { AgGridBooleanCellRendererComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-boolean-cell-renderer.component';
import { AgGridSkeletonOverlayComponent } from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-skeleton-overlay.component';
import {
  AgGridActionCellRendererComponent,
  AgGridIconTextCellRendererComponent,
  AgGridNoRowsOverlayComponent,
  AgGridTreeCellRendererComponent,
  AgGridTreeCheckboxCellRendererComponent,
} from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component';
import {
  AgGridInlineInputCellRendererComponent,
  AgGridStepInputCellRendererComponent,
} from '@app/shared/components/ag-grid-table/cell-renderers/ag-grid-inline-input-cell-renderers.component';
import { AgGridCellEditorComponent } from '@app/shared/components/ag-grid-table/cell-editors/ag-grid-cell-editor.component';
import { AgGridTableQueryBuilderService } from '@app/shared/components/ag-grid-table/services/ag-grid-table-query-builder.service';
import { AgGridTableStateService } from '@app/shared/components/ag-grid-table/services/ag-grid-table-state.service';
import { ThemeService } from '@app/services/theme.service';
import { normalizeAgGridTableFilterOptions } from '@app/shared/components/ag-grid-table/utils/ag-grid-table.filter-utils';
import {
  AgGridComboBoxData,
  AgGridCustomButton,
  AgGridMultiSelectData,
  AgGridTableCellEditEvent,
  AgGridTableColumn,
  AgGridTableColumnSetting,
  AgGridTableDisplayConfig,
  AgGridTableEditorConfig,
  AgGridTableFetchRequest,
  AgGridTableODataSourceConfig,
  AgGridTableToolbarConfig,
  AgGridTableResult,
  AgGridTableRowAction,
  AgGridTableRowActionEvent,
  AgGridTableToolbarActionEvent,
  AgGridToolbarFilter,
  AgGridToolbarSegmentGroup,
  GridTableColumnDataType,
} from '@app/shared/components/ag-grid-table/types/ag-grid-table.types';

ModuleRegistry.registerModules([AllCommunityModule]);

@Component({
  selector: 'app-ag-grid-table',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    DragDropModule,
    Ui5MainModule,
    AgGridAngular,
  ],
  templateUrl: './ag-grid-table.component.html',
  styleUrl: './ag-grid-table.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AgGridTableComponent<TData = any>
  implements OnInit, OnChanges, OnDestroy
{
  @ViewChild(AgGridAngular) agGrid?: AgGridAngular<TData>;

  // ─── Required ────────────────────────────────────────────────────────────────
  @Input({ required: true }) columns: AgGridTableColumn<TData>[] = [];
  @Input() dataSource: AgGridTableODataSourceConfig<TData> | undefined;
  @Input() toolbarConfig: AgGridTableToolbarConfig = {};
  @Input() displayConfig: AgGridTableDisplayConfig = {};

  // ─── Flat data-source inputs (mirrors custom-grid-table API) ─────────────────
  @Input() url = '';
  @Input() customUrl = '';
  @Input() expandQuery = '';
  @Input() filterQuery = '';
  @Input() additionalFilterQuery = '';
  @Input() limit = 0;
  @Input() searchFields: string[] = [];

  protected ResolveDataSource = this.resolveDataSource();
  protected ResolveToolbar = this.resolveToolbar();
  protected ResolveDisplay = this.resolveDisplay();

  private resolveDataSource() {
    const d = this.dataSource;
    return {
      type: d?.type ?? 'odata',
      endpoint: this.url || d?.endpoint || '',
      customEndpoint: this.customUrl || d?.customEndpoint || '',
      filter: d?.filter ?? '',
      baseFilter: this.filterQuery || d?.baseFilter || '',
      additionalFilter: this.additionalFilterQuery || d?.additionalFilter || '',
      expand: this.expandQuery || d?.expand || '',
      data: (d?.data ?? []) as TData[],
      staticData: d?.staticData ?? false,
      pageSize: this.limit || d?.pageSize || 40,
      sortBy: d?.sortBy ?? '',
      sortDirection: d?.sortDirection ?? 'asc',
      searchFields: this.searchFields.length ? this.searchFields : (d?.searchFields ?? []),
      serverSearch: d?.serverSearch ?? false,
      ignoreQueryBuilder: d?.ignoreQueryBuilder ?? false,
      customApi: !!this.customUrl || d?.customApi || false,
      customApiManual: d?.customApiManual ?? false,
      fromCustomPaginator: d?.fromCustomPaginator ?? false,
      resultField: d?.resultField ?? '',
      customSorting: d?.customSorting ?? false,
      pagination: d?.pagination ?? false,
      paginationPageSize: d?.paginationPageSize,
      scrollPagination: d?.scrollPagination ?? true,
    };
  }

  private resolveToolbar() {
    const t = this.toolbarConfig;
    return {
      headerTitle: t?.headerTitle ?? '',
      showRowCount: t?.showRowCount ?? false,
      showSearch: t?.showSearch ?? true,
      searchPlaceholder: t?.searchPlaceholder ?? $localize`Search`,
      isGlobalSearchVisible: t?.isGlobalSearchVisible ?? true,
      showScanner: t?.showScanner ?? false,
      showNewButton: t?.showNewButton ?? false,
      addButtonText: t?.addButtonText ?? $localize`Add`,
      addButtonDisable: t?.addButtonDisable ?? false,
      showRefreshButton: t?.showRefreshButton ?? false,
      refButtonText: t?.refButtonText ?? $localize`Refresh`,
      showExtraButton: t?.showExtraButton ?? false,
      extraButtonText: t?.extraButtonText ?? $localize`Extra`,
      extraButtonDesign: t?.extraButtonDesign ?? 'Transparent',
      extraButtonDisable: t?.extraButtonDisable ?? false,
      showResetButton: t?.showResetButton ?? false,
      resetButtonText: t?.resetButtonText ?? $localize`Reset`,
      showSyncButton: t?.showSyncButton ?? false,
      syncButtonText: t?.syncButtonText ?? $localize`Sync`,
      syncButtonDisable: t?.syncButtonDisable ?? false,
      showDownload: t?.showDownload ?? false,
      disableDownloadButton: t?.disableDownloadButton ?? false,
      showUpload: t?.showUpload ?? false,
      disableUploadButton: t?.disableUploadButton ?? false,
      showDeleteButtonInHeader: t?.showDeleteButtonInHeader ?? false,
      deleteButtonText: t?.deleteButtonText ?? $localize`Delete`,
      showTripButtons: t?.showTripButtons ?? false,
      clearTrip: t?.clearTrip ?? $localize`Clear Trip`,
      productionDefaultButtonText: t?.productionDefaultButtonText ?? '',
      showTableSettingBtn: t?.showTableSettingBtn ?? true,
      showValueHelp: t?.showValueHelp ?? false,
      showSegmentButton: t?.showSegmentButton ?? false,
      button1Text: t?.button1Text ?? $localize`All`,
      button2Text: t?.button2Text ?? $localize`Active`,
      button3Text: t?.button3Text ?? $localize`Inactive`,
      button4Text: t?.button4Text ?? '',
    };
  }

  private resolveDisplay() {
    const d = this.displayConfig;
    return {
      gridHeight: d?.gridHeight ?? 'calc(100vh - 118px)',
      rowHeight: d?.rowHeight,
      headerRowHeight: d?.headerRowHeight,
      isCozy: d?.isCozy ?? false,
      alternateRowColors: d?.alternateRowColors ?? true,
      fillEmptyRows: d?.fillEmptyRows ?? true,
      loadingDelay: d?.loadingDelay ?? 0,
      withRowHighlight: d?.withRowHighlight ?? false,
      highlightFieldColumn: d?.highlightFieldColumn ?? '',
    };
  }

  // ─── State / persistence ──────────────────────────────────────────────────────
  @Input() gridId = '';
  @Input() isBase = false;
  @Input() isTableCacheEnabled = true;
  @Input() keyForCacheCustomDataTableColumns = '';

  // ─── Selection ──────────────────────────────────────────────────────────────────
  @Input() selectionMode: 'Single' | 'Multiple' | 'None' = 'None';
  @Input() selectionRowBehavior: 'Row' | 'RowOnly' | 'RowSelector' = 'RowOnly';
  @Input() selectedRowsId: Record<string, boolean> = {};
  @Input() disableColumnRule: ((row: TData) => boolean) | null = null;

  // ─── Misc display (not yet grouped) ─────────────────────────────────────────────
  @Input() noRowsMessage = $localize`No records found`;
  @Input() isBusy = false;             // external loading override
  @Input() globalFilterValue = '';     // client-side quick filter
  @Input() isAdmin = true;
  @Input() isTreeTable = false;        // enable tree display mode; data must be a flat array with _level:0|1, _parentId, _isLeaf on each row
  @Input() onDoubleClick?: (row: TData) => void;

  // ─── Illustrated / empty-state message ──────────────────────────────────────────
  @Input() showIllustratedMessage = true;
  @Input() IllustratedName = 'NoData';
  @Input() IllustratedTitle = $localize`There's no data yet`;
  @Input() IllustratedSubtitle = $localize`When there is, you'll see it here.`;
  @Input() IllustratedMessageHeight = '';

  // ─── Toolbar (not yet grouped) ──────────────────────────────────────────────────
  @Input() valueHelpers: any[] = [];
  @Input() isBeforeDefaultButon = false;

  // ─── Switch ───────────────────────────────────────────────────────────────────
  @Input() showSwitch = false;
  @Input() ShowSwitch = false;         // legacy alternate flag
  @Input() selectedSwitchValue = false;
  @Input() switchLabel = '';
  @Input() switchComponent: any;      // custom switch renderer (not used in AG Grid)
  @Input() switchValue: any;

  // ─── Date pickers (direct, legacy style) ─────────────────────────────────────
  @Input() showDatePicker = false;
  @Input() showDateRangePicker = false;
  @Input() datePickerPlaceholder = '';
  @Input() dateRangePickerPlaceholder = '';
  @Input() datePickerValue = '';
  @Input() dateRangePickerValue = '';
  @Input() datePickerFormat = 'dd/MM/yyyy';

  // ─── Combo boxes (legacy, up to 2) ────────────────────────────────────────────
  @Input() isComboBoxOneActive = false;
  @Input() isComboBoxTwoActive = false;
  @Input() comboBoxOneLabelText = '';
  @Input() comboBoxTwoLabelText = '';
  @Input() comboBoxOneDisabled = false;
  @Input() comboBoxOneData?: AgGridComboBoxData;
  @Input() comboBoxTwoData?: AgGridComboBoxData;

  // ─── Multi-selects (legacy, up to 4) ─────────────────────────────────────────
  @Input() isMultiSelectOneActive = false;
  @Input() isMultiSelectTwoActive = false;
  @Input() isMultiSelectThreeActive = false;
  @Input() isMultiSelectFourActive = false;
  @Input() multiSelectOneLabelText = '';
  @Input() multiSelectTwoLabelText = '';
  @Input() multiSelectThreeLabelText = '';
  @Input() multiSelectFourLabelText = '';
  @Input() multiSelectOnePlaceholder = '';
  @Input() multiSelectTwoPlaceholder = '';
  @Input() multiSelectThreePlaceholder = '';
  @Input() multiSelectFourPlaceholder = '';
  @Input() isMultiSelectOneSelectAllFlag = true;
  @Input() multiSelectOneData?: AgGridMultiSelectData;
  @Input() multiSelectTwoData?: AgGridMultiSelectData;
  @Input() multiSelectThreeData?: AgGridMultiSelectData;
  @Input() multiSelectFourData?: AgGridMultiSelectData;

  // ─── Segmented button groups ──────────────────────────────────────────────────
  @Input() segmentButtonItems: { id: string; name: string; defaultSelect?: boolean }[] = [];
  @Input() customTitleSegmentButtons: any[] = [];

  // ─── Custom button arrays ─────────────────────────────────────────────────────
  @Input() customSecondaryToolbarButtons: AgGridCustomButton[] = [];
  @Input() multipleButtons: AgGridCustomButton[] = [];
  @Input() customActionButtons: AgGridCustomButton[] = [];

  // ─── Editing ──────────────────────────────────────────────────────────────────
  @Input() singleClickEdit = false;

  // ─── Action column ────────────────────────────────────────────────────────────
  @Input() showAction = false;
  @Input() editPermission = true;
  @Input() showEditButton = true;
  @Input() showDeleteButton = true;
  @Input() showInfoButton = false;
  @Input() editDisabledFn?: (row: TData) => boolean;
  @Input() deleteDisabledFn?: (row: TData) => boolean;

  // ─── Advanced toolbar controls ────────────────────────────────────────────────
  @Input() toolbarFilters: AgGridToolbarFilter[] = [];
  @Input() toolbarSegments: AgGridToolbarSegmentGroup[] = [];

  // ─── Toolbar @Outputs ─────────────────────────────────────────────────────────
  @Output() newButtonClick = new EventEmitter<void>();
  @Output() refreshButtonClick = new EventEmitter<void>();
  @Output() extraButtonClick = new EventEmitter<void>();
  @Output() resetButtonClick = new EventEmitter<void>();
  @Output() syncButtonClick = new EventEmitter<void>();
  @Output() downloadButtonClick = new EventEmitter<void>();
  @Output() uploadButtonClick = new EventEmitter<void>();
  @Output() deleteButtonClick = new EventEmitter<void>();
  @Output() settingsButtonClick = new EventEmitter<void>();
  @Output() clearButtonClick = new EventEmitter<void>();
  @Output() valueHelperButtonClick = new EventEmitter<any>();
  @Output() segmentedButtonClick = new EventEmitter<any>();
  @Output() segmentButtonChange = new EventEmitter<any>();
  @Output() toolbarAction = new EventEmitter<AgGridTableToolbarActionEvent>();
  @Output() productionDefaultButton = new EventEmitter<void>();
  @Output() productionButton = new EventEmitter<void>();
  @Output() multipleButtonEmitter = new EventEmitter<any>();
  @Output() defaultButtonClick = new EventEmitter<void>();
  @Output() onSwitchChange = new EventEmitter<boolean>();
  @Output() changeDatePicker = new EventEmitter<any>();
  @Output() changeRangeDatePicker = new EventEmitter<any>();
  @Output() comboBoxOneSelectionChanged = new EventEmitter<any>();
  @Output() comboBoxTwoSelectionChanged = new EventEmitter<any>();
  @Output() multiSelectOneSelectionChanged = new EventEmitter<any>();
  @Output() multiSelectTwoSelectionChanged = new EventEmitter<any>();
  @Output() multiSelectThreeSelectionChanged = new EventEmitter<any>();
  @Output() multiSelectFourSelectionChanged = new EventEmitter<any>();

  // ─── Grid @Outputs ────────────────────────────────────────────────────────────
  @Output() rowClick = new EventEmitter<TData>();
  @Output() rowDoubleClicked = new EventEmitter<TData>();
  @Output() selectionChanged = new EventEmitter<TData[]>();
  @Output() editClick = new EventEmitter<TData>();
  @Output() deleteClick = new EventEmitter<TData>();
  @Output() deleteClickNew = new EventEmitter<TData>();   // full row (same as deleteClick)
  @Output() infoClick = new EventEmitter<TData>();
  @Output() rowAction = new EventEmitter<AgGridTableRowActionEvent<TData>>();
  @Output() cellEdited = new EventEmitter<AgGridTableCellEditEvent<TData>>();
  @Output() processData = new EventEmitter<any[]>();
  // Fires for each additional batch fetched via infinite-scroll (loadMoreRows) — kept
  // separate from `processData` (first-page-only) because several existing consumers'
  // `processData` handlers do non-idempotent things on every call (full grid reload,
  // force-reselect row 0), which would misbehave/loop if re-fired on every scroll batch.
  // Consumers that need to enrich/react to every batch (not just the first) should bind
  // this in addition to `processData`.
  @Output() moreRowsLoaded = new EventEmitter<any[]>();
  @Output() dataLoaded = new EventEmitter<number>();
  @Output() onColumnFilter = new EventEmitter<any>();
  @Output() columnReorder = new EventEmitter<any>();
  @Output() customSorting = new EventEmitter<any>();
  @Output() searchClick = new EventEmitter<any>();
  @Output() onSearchForCustomAPI = new EventEmitter<any>();
  @Output() onSearchOnKeyUp = new EventEmitter<any>();
  @Output() onLoadMoreForCustomAPI = new EventEmitter<void>();
  @Output() onInputValueChange = new EventEmitter<any>();
  @Output() incrementorRealtimeValue = new EventEmitter<any>();

  // ─── AG Grid defaults ────────────────────────────────────────────────────────
  protected readonly modules = [AllCommunityModule];
  protected readonly defaultColDef: ColDef<TData> = {
    sortable: true,
    filter: 'agTextColumnFilter',
    filterParams: { debounceMs: 400 },
    resizable: true,
    minWidth: 140,
    suppressHeaderMenuButton: true,
    headerComponent: AgGridCustomHeaderComponent,
  };

  // App-wide date format: DD/MM/YYYY. AG Grid auto-infers 'dateString'/'dateTimeString' for any
  // raw ISO date(-time) string column with no explicit valueFormatter — without this override it
  // falls back to AG Grid's own default (locale-dependent), which reads as MM/DD/YYYY for many users.
  protected readonly dataTypeDefinitions: Record<string, DataTypeDefinition<TData>> = {
    dateString: {
      baseDataType: 'dateString',
      extendsDataType: 'dateString',
      valueFormatter: ({ value }) => (value ? moment(value).format('DD/MM/YYYY') : ''),
    },
    dateTimeString: {
      baseDataType: 'dateTimeString',
      extendsDataType: 'dateTimeString',
      valueFormatter: ({ value }) => (value ? moment(value).format('DD/MM/YYYY') : ''),
    },
  };

  readonly noRowsOverlayComponent = AgGridNoRowsOverlayComponent;
  readonly loadingOverlayComponent = AgGridSkeletonOverlayComponent;

  // Cached so the template binding [noRowsOverlayComponentParams] returns a STABLE
  // reference between change-detection cycles (the getter previously allocated a new
  // object every CD pass → repeated AG Grid input diffing). Rebuilt only when one of
  // the illustrated-message inputs actually changes (see ngOnChanges).
  private _noRowsOverlayParams: Record<string, unknown> = this.buildNoRowsOverlayParams();

  get noRowsOverlayParams(): Record<string, unknown> {
    return this._noRowsOverlayParams;
  }

  private buildNoRowsOverlayParams(): Record<string, unknown> {
    return {
      showIllustrated: this.showIllustratedMessage,
      illustratedName: this.IllustratedName,
      title: this.IllustratedTitle,
      subtitle: this.IllustratedSubtitle,
      height: this.IllustratedMessageHeight,
      message: this.noRowsMessage,
    };
  }

  // ─── Runtime state ────────────────────────────────────────────────────────────
  protected gridApi?: GridApi<TData>;
  protected columnDefs: ColDef<TData>[] = [];
  private _persistedSelectionIds = new Set<string>();
  // True while the header select-all is engaged. Drives auto-selection of freshly-loaded
  // blocks (Infinite Row Model) so scrolling keeps the whole dataset selected.
  private selectAllActive = false;
  // Stable row-id fallback for client-side static rows that have no DB id yet
  // (e.g. new bank/asset records added before the parent entity is saved).
  // WeakMap keeps the mapping alive only while the data object exists — no leak.
  private readonly _localRowIdMap = new WeakMap<object, string>();
  private _localRowIdCounter = 0;

  protected readonly rowIdGetter = (params: GetRowIdParams): string => {
    const data = params.data as any;
    if (!data) return '';
    const id = data['id'];
    if (id !== undefined && id !== null && id !== 0 && id !== '') return String(id);
    // No real DB id — assign a stable local key so AG Grid does not deduplicate
    // multiple unsaved rows that all resolve to the same empty-string id.
    if (!this._localRowIdMap.has(data)) {
      this._localRowIdMap.set(data, `__local_${++this._localRowIdCounter}`);
    }
    return this._localRowIdMap.get(data)!;
  };
  protected totalRowCount = 0;
  protected isGridLoading = false;
  protected searchText = '';
  protected isColumnSettingsOpen = false;
  protected isResetConfirmOpen = false;
  protected columnSettingsDraft: AgGridTableColumnSetting[] = [];
  protected columnSettingsSearch = '';
  // trackBy keeps list-row DOM stable across search / reorder / select-all rebuilds.
  protected readonly trackBySettingColId = (_: number, s: AgGridTableColumnSetting): string => s.colId;
  protected activeSegment: 'all' | 'active' | 'inactive' | string = 'all';
  protected segmentValues: Record<string, string> = {};
  protected activeSegmentedItem = 'ALL';   // legacy ALL/ACTIVE/INACTIVE
  private legacySegmentFilter = '';        // OData $filter fragment from segmentButtonItems[].filter

  private readonly destroy$ = new Subject<void>();
  private readonly searchInput$ = new Subject<string>();
  // Emitting cancels all in-flight OData requests (prevents stale successCallback)
  private readonly fetchCancel$ = new Subject<void>();
  // Debounces localStorage writes triggered by column resize/move/sort/filter
  private readonly saveStateTrigger$ = new Subject<void>();
  private initialColumnState: ColumnState[] = [];
  // True once the user has a persisted column layout (restored from storage) or has
  // manually resized/moved/hidden a column. While true, sizeColumnsToFit is suppressed
  // so the user's exact widths/order are preserved on reload + container resize.
  // While false (fresh grid, no saved state) auto-fit fills the available width.
  private userColumnStateActive = false;
  private lastSortModelJson = '';
  private lastFilterModelJson = '';
  // Cached total row count — skips $count on subsequent page fetches
  private knownRowCount: number | undefined;
  // Scroll-based incremental load state
  private readonly SCROLL_PAGE_SIZE = 40;
  private readonly SCROLL_TRIGGER_THRESHOLD_PX = 400;
  private currentSkip = 0;
  private allRowsLoaded = false;
  protected isFetchingMore = false;
  // Block response cache — key: endpoint?params, value: fetched rows+total
  private readonly blockCache = new Map<string, AgGridTableResult<TData>>();
  private readonly BLOCK_CACHE_MAX = 200;
  // ─── Placeholder filler rows ─────────────────────────────────────────────────
  // Marks a pinnedBottomRow as an inert visual filler (not real data).
  private static readonly PLACEHOLDER_FLAG = '__agFiller__';
  // rAF handle coalescing recalcs triggered by model/size changes.
  private placeholderRaf: number | null = null;
  // Number of filler rows currently in pinnedBottomRowData — tracked locally so we
  // can skip redundant clears without querying the grid API.
  private placeholderRowCount = 0;
  // Signature (count|emptyPx) of the last applied filler set. When a model/size burst
  // recomputes the same geometry, the pinnedBottomRowData write is skipped → avoids
  // redundant pinned-row redraws during scrolling/resize.
  private lastPlaceholderSig = '';
  // rAF handle coalescing sizeColumnsToFit() across burst resize events
  // (window resize, sidebar collapse/expand, container resize).
  private fitColumnsRaf: number | null = null;
  // Function cell renderer for placeholder cells → renders nothing.
  protected readonly blankCellRenderer = (): string => '';
  // Per-row height: placeholder filler rows match the data row height; the
  // bottom-most filler absorbs the sub-row remainder so the body fills exactly.
  protected readonly getRowHeight = (params: RowHeightParams<TData>): number | undefined => {
    const base = this.resolvedRowHeight;
    const data = params.node?.data as Record<string, unknown> | undefined;
    if (params.node?.rowPinned === 'bottom' && data?.[AgGridTableComponent.PLACEHOLDER_FLAG]) {
      return base + ((data['__extra__'] as number) || 0);
    }
    return base;
  };
  // Stripe placeholder rows so their odd/even parity continues the real rows.
  // Pinned rows index from 0 locally, so absolute index = realCount + localIndex.
  // Uses the theme background vars (so it honours alternateRowColors automatically).
  protected readonly getRowStyle = (params: RowClassParams<TData>): Record<string, string> | undefined => {
    const data = params.node?.data as Record<string, unknown> | undefined;
    if (params.node?.rowPinned === 'bottom' && data?.[AgGridTableComponent.PLACEHOLDER_FLAG]) {
      const realCount = this.gridApi?.getDisplayedRowCount() ?? 0;
      const odd = (realCount + (params.node.rowIndex ?? 0)) % 2 === 1;
      return {
        background: odd ? 'var(--ag-odd-row-background-color)' : 'var(--ag-background-color, #fff)',
      };
    }
    return undefined;
  };

  // Direct-OData column filters keyed by colId. The multiSelect header bypasses AG Grid's
  // filter model and pushes a ready-built $filter fragment here; folded into buildCombinedFilter().
  private readonly columnOdataFilters = new Map<string, string>();

  // Broadcasts the colId of a newly-opened column filter popup so all other headers close.
  readonly filterPopupOpened$ = new Subject<string>();

  // Passed to AG Grid as `context` so in-header components can reach back to this instance.
  readonly gridContext = {
    setColumnOdataFilter: (colId: string, model: any) => this.setColumnOdataFilter(colId, model),
    toggleSelectAll: (checked: boolean) => this.toggleSelectAll(checked),
    getSelectAllState: () => this.getSelectAllState(),
    filterPopupOpened$: this.filterPopupOpened$,
  };

  @HostBinding('class.is-dark') isDarkTheme = false;
  protected agGridTheme: typeof themeQuartz = themeQuartz;

  private updateTheme(): void {
    // actual table theme
    // themeQuartz.withParams({ columnBorder: true, headerColumnBorder: true });
    this.isDarkTheme = this.themeService.isDarkTheme();
    this.agGridTheme = this.isDarkTheme
      ? themeQuartz.withPart(colorSchemeDark).withParams({
          columnBorder: true,
          headerColumnBorder: true,
          backgroundColor: 'var(--sapList_Background)',
          headerBackgroundColor: 'var(--sapList_HeaderBackground)',
          oddRowBackgroundColor: 'var(--sapList_AlternatingBackground)',
          rowHoverColor: 'var(--sapList_Hover_Background)',
          selectedRowBackgroundColor: 'var(--sapList_SelectionBackgroundColor)',
          borderColor: 'var(--sapList_BorderColor)',
          foregroundColor: 'var(--sapTextColor)',
        })
      : themeQuartz.withParams({ columnBorder: true, headerColumnBorder: true });
  }

  constructor(
    private commonService: CommonService,
    private queryBuilder: AgGridTableQueryBuilderService,
    private stateService: AgGridTableStateService,
    private cdr: ChangeDetectorRef,
    private el: ElementRef<HTMLElement>,
    private themeService: ThemeService,
  ) {
    this.updateTheme();

    this.searchInput$
      .pipe(debounceTime(600), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((value) => {
        this.searchText = value;
        this.cdr.markForCheck();
        if (this.ResolveDataSource.customApi) {
          this.searchClick.emit(value);
          this.onSearchForCustomAPI.emit(value);
        } else {
          this.runSearch(value);
        }
      });

    this.saveStateTrigger$
      .pipe(debounceTime(600), takeUntil(this.destroy$))
      .subscribe(() => this._persistState());
  }

  ngOnInit(): void {
    this.themeService.theme$.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.updateTheme();
      this.cdr.markForCheck();
    });
    this.initCustomSegmentDefaults();
    this.initSegmentedState();
  }

  ngOnChanges(changes: SimpleChanges): void {
    // Re-merge a config with its defaults whenever the parent reassigns it.
    if (changes['dataSource'] || changes['url'] || changes['customUrl'] ||
        changes['expandQuery'] || changes['filterQuery'] || changes['additionalFilterQuery'] ||
        changes['limit'] || changes['searchFields']) {
      this.ResolveDataSource = this.resolveDataSource();
    }
    if (changes['toolbarConfig']) this.ResolveToolbar = this.resolveToolbar();
    if (changes['displayConfig']) this.ResolveDisplay = this.resolveDisplay();

    if (changes['columns'] || changes['showAction'] || changes['editPermission'] ||
        changes['showEditButton'] || changes['showDeleteButton'] ||
        changes['showInfoButton'] || changes['customActionButtons'] || changes['selectionMode']) {
      this.columnDefs = this.buildColumnDefs();
      if (this.gridApi) {
        this.gridApi.setGridOption('rowSelection', this.resolvedSelectionMode);
        this.scheduleFitColumns();
      }
    }

    // External busy override
    if (changes['isBusy'] && this.gridApi) {
      this.gridApi.setGridOption('loading', this.isBusy);
    }

    // Client-side global filter
    if (changes['globalFilterValue'] && this.gridApi) {
      this.gridApi.setGridOption('quickFilterText', this.globalFilterValue);
    }

    if (changes['toolbarSegments']) {
      this.initCustomSegmentDefaults();
    }

    // Rebuild the cached no-rows overlay params when any illustrated-message input
    // changes (keeps the template binding reference stable between CD cycles otherwise),
    // then push the refreshed object to a live grid.
    if (changes['showIllustratedMessage'] || changes['IllustratedName'] ||
        changes['IllustratedTitle'] || changes['IllustratedSubtitle'] ||
        changes['IllustratedMessageHeight'] || changes['noRowsMessage']) {
      this._noRowsOverlayParams = this.buildNoRowsOverlayParams();
      this.gridApi?.setGridOption('noRowsOverlayComponentParams', this._noRowsOverlayParams);
    }

    // Data source reconfigured — endpoint/filter/sort/pagination or static/parent-driven data
    const dataSourceChanged = changes['dataSource'] || changes['url'] || changes['customUrl'] ||
      changes['expandQuery'] || changes['filterQuery'] || changes['additionalFilterQuery'] ||
      changes['limit'] || changes['searchFields'];
    if (dataSourceChanged && this.gridApi) {
      if (this.ResolveDataSource.staticData || this.ResolveDataSource.customApi) {
        this.resolvedRowData = [...(this.ResolveDataSource.data ?? [])];
        this.totalRowCount = this.resolvedRowData.length;
        this.cdr.markForCheck();
      } else if (!changes['dataSource']?.firstChange && !this.ResolveDataSource.customApiManual) {
        this.refreshGridData(true);
      }
    }
  }

  ngOnDestroy(): void {
    if (this.placeholderRaf != null) cancelAnimationFrame(this.placeholderRaf);
    if (this.fitColumnsRaf != null) cancelAnimationFrame(this.fitColumnsRaf);
    // Cancel a pending single/double-click timer so it cannot fire (rowClick /
    // rowDoubleClicked / onDoubleClick) on a destroyed component when a row is clicked
    // immediately before the host navigates away.
    if (this.clickTimer != null) clearTimeout(this.clickTimer);
    // Release cached block responses + column filter fragments for GC.
    this.blockCache.clear();
    this.columnOdataFilters.clear();
    this.destroy$.next();
    this.destroy$.complete();
  }

  // ─── Grid events ─────────────────────────────────────────────────────────────

  onGridReady(event: GridReadyEvent<TData>): void {
    this.gridApi = event.api;

    this.columnDefs = this.buildColumnDefs();
    // Capture the pristine default (straight from colDefs) BEFORE restoring any saved
    // layout — otherwise "Reset to Default" would snap back to the last saved state, not
    // the factory default.
    this.initialColumnState = this.gridApi.getColumnState();
    this.restoreSavedState();

    if (this.isTreeTable) this.initTreeExpansion();

    const strategy = this.dataSourceStrategy;

    // Initial sort — always applied when sortBy is configured, even over a saved state.
    // defaultState clears any saved sort on other columns so only the configured column sorts.
    // Must run BEFORE loadRows() — loadRows() reads getColumnState() synchronously to build
    // its sortModel, so applying this after the fetch was kicked off would miss the first request.
    if (strategy !== 'static' && strategy !== 'customApi' &&
        this.ResolveDataSource.sortBy) {
      this.gridApi.applyColumnState({
        defaultState: { sort: null },
        state: [{ colId: this.ResolveDataSource.sortBy, sort: this.ResolveDataSource.sortDirection ?? 'asc', sortIndex: 0 }],
      });
    }

    switch (strategy) {
      case 'static':
      case 'customApi':
        // Client-side row model — rows supplied directly / by the parent
        this.gridApi.setGridOption('rowData', this.ResolveDataSource.data);
        this.totalRowCount = this.ResolveDataSource.data.length;
        break;

      case 'api':
      case 'odata':
      default:
        this.gridApi.setGridOption('loading', true);
        this.loadRows();
        break;
    }

    // Apply per-row selection disable (skip for tree tables — checkboxes must always show)
    if (this.disableColumnRule && !this.isTreeTable) {
      this.gridApi.setGridOption('isRowSelectable', (node) =>
        node.data ? !this.disableColumnRule!(node.data) : true,
      );
    }

    if (this.isBusy) this.gridApi.setGridOption('loading', true);
    if (this.globalFilterValue) this.gridApi.setGridOption('quickFilterText', this.globalFilterValue);

    // NOTE: do NOT rebuild columnDefs here — reassigning columnDefs makes AG Grid
    // reset column order/width to the def defaults, wiping restoreSavedState() above.
    // columnDefs is already built before restore (and via ngOnChanges).

    this.scheduleFitColumns();
    this.schedulePlaceholderUpdate();
  }

  // Fires on every row-model change (data loaded, infinite block fetched,
  // filter/sort applied). Pinned rows are NOT part of the row model, so
  // setting pinnedBottomRowData does not re-trigger this → no loop.
  onModelUpdated(): void {
    this.schedulePlaceholderUpdate();
    // Select-all is active and the model just caught up with a freshly-scrolled-in
    // block — sweep now, while AG Grid's row nodes are guaranteed to be in sync
    // with resolvedRowData (a setTimeout(0) right after the fetch is NOT enough:
    // it can fire before Angular's own [rowData] binding update reaches AG Grid,
    // permanently missing the row nodes for whichever batch has no next batch
    // to "catch up" the strays on — i.e. always the very last one).
    if (this.selectAllActive) this.selectFreshlyLoadedRows();
  }

  // Columns + initial rows are laid out — first chance to fit to real width.
  onFirstDataRendered(): void {
    this.scheduleFitColumns();
    this.schedulePlaceholderUpdate();
  }

  // Fires when the grid container resizes (window resize, sidebar collapse/expand,
  // container resize). Refit columns to the new width, then top up filler rows.
  onGridSizeChanged(): void {
    this.scheduleFitColumns();
    this.schedulePlaceholderUpdate();
  }

  // ─── Placeholder filler rows ─────────────────────────────────────────────────
  // Coalesce bursts of model/size events into one recalc after layout settles.
  private schedulePlaceholderUpdate(): void {
    if (!this.ResolveDisplay.fillEmptyRows) return;
    if (this.placeholderRaf != null) cancelAnimationFrame(this.placeholderRaf);
    this.placeholderRaf = requestAnimationFrame(() => {
      this.placeholderRaf = null;
      this.updatePlaceholderRows();
    });
  }

  // ─── Responsive column sizing ─────────────────────────────────────────────────
  // Distribute the available grid width across visible columns. AG Grid's
  // sizeColumnsToFit respects each column's minWidth/maxWidth and skips columns
  // flagged suppressSizeToFit (the fixed Action column), so important columns grow
  // to fill empty space while small ones stay narrow — no horizontal scroll unless
  // the sum of minWidths exceeds the viewport. Coalesced via rAF so burst resize
  // events (window/sidebar/container) trigger a single recompute after layout settles.
  private scheduleFitColumns(): void {
    if (this.fitColumnsRaf != null) cancelAnimationFrame(this.fitColumnsRaf);
    this.fitColumnsRaf = requestAnimationFrame(() => {
      this.fitColumnsRaf = null;
      // Respect a user-customized layout — but only while it still fills the viewport.
      // A restored/manual layout can fall short of the current width (route revisit on a
      // wider screen, sidebar collapse, a column added/renamed since the layout was saved),
      // which otherwise leaves a permanent empty gap before the pinned Action column since
      // sizeColumnsToFit would never run again. If the user intentionally widened columns
      // past the viewport (horizontal scroll), leave it alone.
      if (this.userColumnStateActive && !this.hasColumnWidthGap()) return;
      this.gridApi?.sizeColumnsToFit();
    });
  }

  // True when the visible (non-pinned) columns leave empty space in the center
  // viewport — i.e. a restored/manual layout no longer covers the grid's actual width.
  private hasColumnWidthGap(): boolean {
    const api = this.gridApi;
    if (!api) return false;
    const viewport = this.el.nativeElement.querySelector('.ag-center-cols-viewport') as HTMLElement | null;
    if (!viewport || viewport.clientWidth <= 0) return false;
    const columnsWidth = api.getDisplayedCenterColumns()
      .reduce((sum, col) => sum + col.getActualWidth(), 0);
    return columnsWidth < viewport.clientWidth;
  }

  // Push just enough blank pinned-bottom rows to fill the viewport below the last
  // real row. Pinned rows are excluded from the row model, so they never affect
  // rowCount / sorting / filtering / selection / the datasource (API).
  private updatePlaceholderRows(): void {
    const api = this.gridApi;
    if (!api || !this.ResolveDisplay.fillEmptyRows || this.isTreeTable) return;

    const root = this.el.nativeElement;
    const rootWrapper = root.querySelector(
      '.ag-root-wrapper',
    ) as HTMLElement | null;
    const viewport = root.querySelector('.ag-body-viewport') as HTMLElement | null;
    if (!rootWrapper || !viewport) return;
    const header = root.querySelector('.ag-header') as HTMLElement | null;
    const hScroll = root.querySelector(
      '.ag-body-horizontal-scroll',
    ) as HTMLElement | null;

    const rowH = this.resolvedRowHeight;
    if (!rowH || rowH <= 0) return;

    // Body area available for rows = grid height − header − horizontal scrollbar.
    // Measured from the FIXED-height root wrapper, NOT the body viewport: the
    // viewport's flex height is transient during a reload (segment/search/sort) and
    // can read tiny mid-layout, which previously made the filler count collapse to ~1
    // and leave a large blank band. The root wrapper height is constant (= the grid
    // container's CSS height) so the count is correct on the first pass and stable
    // (adding fillers never changes wrapper/header/scrollbar heights → no oscillation).
    const avail =
      rootWrapper.clientHeight -
      (header?.offsetHeight || 0) -
      (hScroll?.offsetHeight || 0);
    if (avail <= 0) return;

    // Real (data) row count. getDisplayedRowCount() can report a virtual,
    // block-padded count in the Infinite Row Model before the last row is known
    // (cacheBlockSize / infiniteInitialRowCount padding). Clamp it by the real
    // server total (set in emitRows — the value we control) so fillers are driven
    // by the true number of data rows, never by AG's interim virtual count.
    const displayed = api.getDisplayedRowCount();
    const realCount =
      this.totalRowCount > 0
        ? Math.min(displayed, this.totalRowCount)
        : displayed;
    const emptyPx = avail - realCount * rowH;

    // Only fill when there is genuinely empty space (data shorter than viewport).
    // Skip entirely on an empty grid so the no-rows overlay shows alone.
    let count = realCount > 0 && emptyPx > 0 ? Math.floor(emptyPx / rowH) : 0;
    if (!isFinite(count) || count < 0) count = 0;

    // Skip when the filler geometry is unchanged since the last applied pass. Model/size
    // bursts (scroll, resize, repeated modelUpdated) re-run this with identical count +
    // empty-space, so this avoids redundant pinnedBottomRowData writes and the pinned-row
    // redraw each one triggers. avail/rowH are already validated as finite & > 0 above.
    const sig = `${count}|${Math.round(emptyPx)}`;
    if (sig === this.lastPlaceholderSig) return;
    this.lastPlaceholderSig = sig;

    if (count === 0) {
      if (this.placeholderRowCount > 0) {
        api.setGridOption('pinnedBottomRowData', []);
        this.placeholderRowCount = 0;
      }
      return;
    }

    // Distribute the sub-row pixel remainder evenly so the floating-bottom section
    // fills exactly emptyPx pixels with no visible gap between the last real row
    // and the fillers. Each row gets baseExtra px; the first (remainder % count)
    // rows get 1px more. All rows stay within ±1px of each other.
    const remainder = emptyPx - count * rowH;
    const baseExtra = remainder > 0 ? Math.floor(remainder / count) : 0;
    const withOneMore = remainder > 0 ? remainder % count : 0;
    const rows: Record<string, unknown>[] = [];
    for (let i = 0; i < count; i++) {
      rows.push({
        // Unique id per filler: getRowId (rowIdGetter) is applied to pinned rows too,
        // and returns String(data.id ?? ''). Without a distinct id every filler would
        // resolve to the same '' key and AG Grid would collapse them into ONE row.
        id: `${AgGridTableComponent.PLACEHOLDER_FLAG}_${i}`,
        [AgGridTableComponent.PLACEHOLDER_FLAG]: true,
        __extra__: i < withOneMore ? baseExtra + 1 : baseExtra,
      });
    }
    api.setGridOption('pinnedBottomRowData', rows as TData[]);
    this.placeholderRowCount = count;
  }

  onCellValueChanged(event: CellValueChangedEvent<TData>): void {
    const colDef = event.colDef as AgGridTableColumn<TData>;
    if (colDef?.afterValueChange) {
      colDef.afterValueChange(event.data, event.column.getColId(), event.newValue, event.oldValue);
    }
    this.cellEdited.emit({ row: event.data, field: event.column.getColId(), newValue: event.newValue, oldValue: event.oldValue });
    this.onInputValueChange.emit({ id: (event.data as any)?.id, data: event.data, accessor: event.column.getColId(), value: event.newValue });
  }

  handleRowClicked(event: RowClickedEvent<TData>): void {
    if (event.node?.rowPinned) return;   // placeholder filler row — ignore
    if (!event.data) return;

    // Tree table: native row-click selection is suppressed (it cleared other rows),
    // so forward the row-body click to the same toggle the checkbox uses. Clicks that
    // originate from the checkbox cell are skipped — its own change event already
    // toggled the row, and re-toggling here would cancel it out.
    if (this.isTreeTable) {
      const src = event.event?.target as HTMLElement | null;
      if (!src?.closest('app-ag-grid-tree-checkbox-cell-renderer')) {
        this.toggleTreeRowSelection(event);
      }
    }

    this.clickCount++;
    clearTimeout(this.clickTimer);
    this.clickTimer = setTimeout(() => {
      if (this.clickCount === 1) {
        this.rowClick.emit(event.data!);
      } else if (this.clickCount >= 2) {
        if (this.onDoubleClick) {
          this.onDoubleClick(event.data!);
        } else {
          this.rowDoubleClicked.emit(event.data!);
        }
      }
      this.clickCount = 0;
    }, 200);
  }

  handleSelectionChanged(event: SelectionChangedEvent<TData>): void {
    if (this.isTreeTable) {
      // Group checkboxes are computed (tri-state), not AG-selected. Re-render the
      // selection column so group state reflects current child selection and leaves
      // mirror their isSelected() state. Then emit leaf rows only.
      event.api.refreshCells({ columns: ['__selection__'], force: true });
      const all = event.api.getSelectedRows() as any[];
      const leafRows = all.filter((r: any) => r._isLeaf === true);
      this._persistedSelectionIds = new Set(leafRows.map((r: any) => String(r?.id ?? '')).filter(Boolean));
      this.selectionChanged.emit(leafRows as TData[]);
      return;
    }

    const rows = event.api.getSelectedRows();
    this._persistedSelectionIds = new Set(rows.map((r: any) => String(r?.id ?? '')).filter(Boolean));
    // Manual deselect down to zero cancels select-all so a later scroll doesn't re-select.
    if (this.selectAllActive && rows.length === 0) this.selectAllActive = false;
    this.selectionChanged.emit(rows);
  }

  // ─── Select-all (header checkbox) ─────────────────────────────────────────────
  // Engaging selects every currently-loaded row; while active, emitRows() auto-selects each
  // freshly-fetched block so scrolling extends selection across the whole dataset (the
  // Community Infinite Row Model has no native cross-block select-all). Selection still flows
  // out through the existing selectionChanged emit — no new outputs.
  private toggleSelectAll(checked: boolean): void {
    if (!this.gridApi) return;
    this.selectAllActive = checked;
    if (checked) {
      this.gridApi.forEachNode((node) => {
        if (!node.rowPinned && node.data) node.setSelected(true, false, 'api');
      });
    } else {
      this.gridApi.deselectAll();
    }
  }

  // Select-all is active and the row model just changed (called from
  // onModelUpdated, so AG Grid's nodes are guaranteed in sync with
  // resolvedRowData) — re-sweep every loaded node. Idempotent: already-selected
  // rows are a no-op, so this safely re-runs on every model update while active.
  private selectFreshlyLoadedRows(): void {
    this.gridApi?.forEachNode((node) => {
      if (!node.rowPinned && node.data) node.setSelected(true, false, 'api');
    });
  }

  // Header checkbox state: 'all' (checked) when every loaded row is selected, 'some'
  // (indeterminate) on a partial selection, 'none' (unchecked) when nothing is selected.
  private getSelectAllState(): 'none' | 'some' | 'all' {
    const api = this.gridApi;
    if (!api) return 'none';
    let loaded = 0;
    let selected = 0;
    api.forEachNode((node) => {
      if (node.rowPinned || !node.data) return;
      loaded++;
      if (node.isSelected()) selected++;
    });
    if (selected === 0) return 'none';
    return selected >= loaded ? 'all' : 'some';
  }

  handleSortChanged(event: SortChangedEvent<TData>): void {
    // Programmatic sort (e.g. the initial applyColumnState in onGridReady) —
    // ignore so it doesn't race/duplicate the grid's own initial data fetch.
    if (event.source === 'api') return;
    const current = JSON.stringify(
      event.api.getColumnState()
        .filter(s => s.sort || s.sortIndex != null)
        .map(s => ({ colId: s.colId, sort: s.sort, sortIndex: s.sortIndex })),
    );
    if (current === this.lastSortModelJson) return;
    this.lastSortModelJson = current;
    if (this.ResolveDataSource.customSorting) {
      this.customSorting.emit(event.api.getColumnState());
    }
    if (this.dataSourceStrategy === 'api' || this.dataSourceStrategy === 'odata') {
      this.refreshGridData(true);
    }
    this.saveState();
  }

  handleFilterChanged(event: FilterChangedEvent<TData>): void {
    if (this.isTreeTable) return; // tree expand/collapse uses external filter, not column filter
    const current = JSON.stringify(event.api.getFilterModel());
    if (current === this.lastFilterModelJson) return;
    this.lastFilterModelJson = current;
    // Cancel any in-flight request so stale filtered data cannot overwrite the new filter state.
    if (this.dataSourceStrategy === 'odata' || this.dataSourceStrategy === 'api') {
      this.fetchCancel$.next();
      this.knownRowCount = undefined;
      this.blockCache.clear();
    }
    if (this.dataSourceStrategy === 'api' || this.dataSourceStrategy === 'odata') {
      this.refreshGridData(true);
    }
    this.onColumnFilter.emit(event.api.getFilterModel());
    this.saveState();
  }

  handleColumnMoved(event: ColumnMovedEvent<TData>): void {
    this.columnReorder.emit(event);
    // User reordered columns → lock the layout (suppress auto-fit) and persist order.
    if (event?.source !== 'api') this.userColumnStateActive = true;
    this.saveState();
  }

  handleColumnStateChanged(event?: { source?: string }): void {
    // Ignore programmatic resizes (sizeColumnsToFit / api) so auto-fit widths are
    // never persisted — only user-driven column resizes are saved.
    if (event && (event.source === 'sizeColumnsToFit' || event.source === 'api')) return;
    // User manually resized → lock the layout so reload/container-resize keeps the width.
    this.userColumnStateActive = true;
    this.saveState();
  }

  handleColumnVisibleChanged(event: ColumnVisibleEvent<TData>): void {
    if (event.source === 'api') return;
    this.userColumnStateActive = true;
    this.saveState();
  }

  // ─── Search ──────────────────────────────────────────────────────────────────

  onSearchInput(event: Event): void {
    const value = (event.target as HTMLInputElement)?.value ?? '';
    // Keep searchText in sync with every keystroke (not just clears) so the
    // [value] binding never re-applies a stale string over what the user just typed.
    this.searchText = value;
    this.onSearchOnKeyUp.emit(value);

    if (!value.trim()) {
      if (this.ResolveDataSource.customApi) {
        this.onSearchForCustomAPI.emit('');
      } else {
        this.runSearch('');
      }
    }

    // Route every value, including empty, through the debounced subject so a
    // pending stale (pre-clear) emission never fires after the field is empty.
    this.searchInput$.next(value);
  }

  // Static strategies filter loaded rows via quickFilter; all server strategies (api + odata) reload.
  private runSearch(value: string): void {
    if (this.dataSourceStrategy === 'static' || this.dataSourceStrategy === 'customApi') {
      this.gridApi?.setGridOption('quickFilterText', value);
    } else {
      this.refreshGridData(true);
    }
  }

  onSearchIconClick(event: Event): void {
    event.stopPropagation();
    const input = (event.target as HTMLElement)?.closest('ui5-input') as any;
    const value = (input?.value ?? this.searchText ?? '').trim();
    this.searchText = value;
    this.searchClick.emit(value);
    if (this.ResolveDataSource.customApi) {
      this.onSearchForCustomAPI.emit(value);
    } else {
      this.runSearch(value);
    }
  }

  onSearchKeyDown(event: KeyboardEvent): void {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    const value = (event.target as HTMLInputElement)?.value?.trim() || '';
    this.searchText = value;
    this.searchClick.emit(value);
    if (this.ResolveDataSource.customApi) {
      this.onSearchForCustomAPI.emit(value);
    } else {
      this.runSearch(value);
    }
  }

  clearSearch(): void {
    if (!this.searchText) return;
    this.searchText = '';
    if (this.ResolveDataSource.customApi) {
      this.onSearchForCustomAPI.emit('');
    } else {
      this.runSearch('');
    }
  }

  // ─── Switch ───────────────────────────────────────────────────────────────────

  handleSwitchChange(): void {
    this.selectedSwitchValue = !this.selectedSwitchValue;
    this.onSwitchChange.emit(this.selectedSwitchValue);
  }

  // ─── Active/Inactive segment ─────────────────────────────────────────────────

  setActiveSegment(seg: 'all' | 'active' | 'inactive' | string): void {
    if (this.activeSegment === seg) return;
    this.activeSegment = seg;
    this.activeSegmentedItem = seg.toUpperCase();
    this.cdr.markForCheck();
    this.segmentedButtonClick.emit(seg);
    if (!this.ResolveDataSource.customApiManual) {
      this.refreshGridData(true);
    }
  }

  // ─── Custom segment groups ────────────────────────────────────────────────────

  isSegmentSelected(groupId: string, itemId: string): boolean {
    return this.segmentValues[groupId] === itemId;
  }

  onSegmentClick(groupId: string, itemId: string): void {
    this.segmentValues = { ...this.segmentValues, [groupId]: itemId };
    this.cdr.markForCheck();
    this.segmentButtonChange.emit({ groupId, value: itemId });
    this.toolbarAction.emit({ actionId: `segment:${groupId}`, value: itemId });
  }

  // ─── Legacy segmentButtonItems ────────────────────────────────────────────────

  isLegacySegmentSelected(item: { id: string; name: string }): boolean {
    return this.activeSegmentedItem === item.id;
  }

  onLegacySegmentClick(item: { id: string; name: string; filter?: string }): void {
    this.activeSegmentedItem = item.id;
    this.legacySegmentFilter = item.filter ?? '';
    this.cdr.markForCheck();
    this.segmentButtonChange.emit(item);
    if (!this.ResolveDataSource.customApiManual) this.refreshGridData(true);
  }

  resetLegacySegment(): void {
    const defaultSeg = this.segmentButtonItems.find(i => i.defaultSelect);
    this.activeSegmentedItem = defaultSeg?.id ?? 'all';
    this.legacySegmentFilter = (defaultSeg as any)?.filter ?? '';
    this.cdr.markForCheck();
  }

  // ─── Toolbar filter controls ──────────────────────────────────────────────────

  onToolbarFilterChange(filterId: string, value: any): void {
    this.toolbarAction.emit({ actionId: `filter:${filterId}`, value });
  }

  // Keeps the select-type toolbar filter showing its current selection — the
  // combobox itself is stateless (fires on change, nothing pre-set), so the
  // caller supplies the current value via filter.value and we resolve it back
  // to the matching option's label for display.
  getSelectFilterDisplayValue(filter: AgGridToolbarFilter): string {
    if (filter.type !== 'select' || !filter.value) return '';
    return this.getFilterOptions(filter).find(opt => opt.value === filter.value)?.label ?? '';
  }

  getFilterOptions(filter: AgGridToolbarFilter): { label: string; value: string }[] {
    if (filter.type === 'select' || filter.type === 'multiSelect') {
      return normalizeAgGridTableFilterOptions(filter.options);
    }
    return [];
  }

  // ComboBoxItem only exposes `text` — no `value` — so the selected item's label
  // is resolved back to its configured value via the filter's own option list.
  resolveSelectFilterValue(filter: AgGridToolbarFilter, text: string | undefined): string {
    if (!text) return '';
    return this.getFilterOptions(filter).find(opt => opt.label === text)?.value ?? '';
  }

  onMultiSelectChange(filterId: string, event: { items?: { text: string }[] }): void {
    const values = (event?.items ?? []).map(i => i.text);
    this.toolbarAction.emit({ actionId: `filter:${filterId}`, value: values });
  }

  getComboOptions(data: AgGridComboBoxData | undefined): { label: string; value: string }[] {
    if (!data?.data?.length) return [];
    return data.data.map(item => ({
      label: String(item[data.textAccessor] ?? ''),
      value: String(item[data.idAccessor] ?? ''),
    }));
  }

  getMultiOptions(data: AgGridMultiSelectData | undefined): { label: string; value: string; selected: boolean }[] {
    if (!data?.data?.length) return [];
    return data.data.map(item => ({
      label: String(item[data.textAccessor] ?? ''),
      value: String(item[data.idAccessor] ?? ''),
      selected: data.isSelectedAccessor ? !!item[data.isSelectedAccessor] : false,
    }));
  }

  trackByLabel(_: number, opt: { label: string }): string {
    return opt.label;
  }

  // ─── Column settings ──────────────────────────────────────────────────────────

  openColumnSettings(): void {
    if (!this.gridApi) return;
    this.columnSettingsDraft = this.buildColumnSettings();
    this.columnSettingsSearch = '';
    this.isColumnSettingsOpen = true;
    this.cdr.markForCheck();
    this.settingsButtonClick.emit();
  }

  closeColumnSettings(): void {
    this.isColumnSettingsOpen = false;
    this.columnSettingsDraft = [];
    this.columnSettingsSearch = '';
    this.cdr.markForCheck();
  }

  // Filtered view of the draft (search by column name). Reorder + visibility state still
  // live on the full columnSettingsDraft; this only narrows what the list renders.
  get displayedColumnSettings(): AgGridTableColumnSetting[] {
    const q = this.columnSettingsSearch.trim().toLowerCase();
    if (!q) return this.columnSettingsDraft;
    return this.columnSettingsDraft.filter(
      (s) =>
        s.headerName.toLowerCase().includes(q) ||
        s.colId.toLowerCase().includes(q) ||
        s.field.toLowerCase().includes(q),
    );
  }

  // Count of columns currently toggled visible in the working copy (header badge).
  get visibleColumnCount(): number {
    return this.columnSettingsDraft.filter((s) => s.visible).length;
  }

  onColumnSettingsSearch(event: Event): void {
    this.columnSettingsSearch = (event.target as HTMLInputElement)?.value ?? '';
    this.cdr.markForCheck();
  }

  // ─── Drag-and-drop reorder (Angular CDK) ───────────────────────────────────
  // Drop reorders the WORKING COPY (draft) only — AG Grid is NOT touched while the
  // dialog is open. The new order is committed to the grid on Submit
  // (applyColumnSettings). Cancel/close discards the draft, so the grid keeps its
  // original order. Dragging is disabled while a search filter is active (the filtered
  // view hides the true neighbours, so a drop position would be ambiguous).
  onColumnDrop(event: CdkDragDrop<AgGridTableColumnSetting[]>): void {
    if (this.columnSettingsSearch) return;
    if (event.previousIndex === event.currentIndex) return;
    const draft = [...this.columnSettingsDraft];
    moveItemInArray(draft, event.previousIndex, event.currentIndex);
    this.columnSettingsDraft = draft;
    this.applyColumnOrderFromDraft();
    this.userColumnStateActive = true;
    this.saveState();
    this.cdr.markForCheck();
  }

  // Pushes the current draft order onto AG Grid (called once, on Submit). Columns
  // absent from the draft (selection / action columns) keep their relative order at the
  // end — their pinned position governs placement, so order among them is irrelevant.
  // Does NOT persist — applyColumnSettings persists once after order + visibility.
  private applyColumnOrderFromDraft(): void {
    if (!this.gridApi) return;
    const order = this.columnSettingsDraft.map((s) => s.colId);
    const rank = (colId: string): number => {
      const i = order.indexOf(colId);
      return i < 0 ? Number.MAX_SAFE_INTEGER : i;
    };
    const reordered = [...this.gridApi.getColumnState()].sort(
      (a, b) => rank(a.colId) - rank(b.colId),
    );
    this.gridApi.applyColumnState({ state: reordered, applyOrder: true });
  }

  selectAllColumns(): void {
    this.columnSettingsDraft = this.columnSettingsDraft.map(s => ({
      ...s,
      visible: true,
    }));
    this.cdr.markForCheck();
  }

  // Per-row visibility toggle (ui5-checkbox). Updates the draft only; the change is
  // applied to the grid on Submit (applyColumnSettings). Locked columns stay visible.
  onColumnVisibilityToggle(setting: AgGridTableColumnSetting, event: Event): void {
    const checked = !!(event.target as HTMLInputElement)?.checked;
    this.columnSettingsDraft = this.columnSettingsDraft.map((s) =>
      s.colId === setting.colId
        ? { ...s, visible: s.lockVisible ? true : checked }
        : s,
    );
    this.cdr.markForCheck();
  }

  openResetConfirm(): void {
    this.isResetConfirmOpen = true;
    this.cdr.markForCheck();
  }

  closeResetConfirm(): void {
    this.isResetConfirmOpen = false;
    this.cdr.markForCheck();
  }

  confirmReset(): void {
    this.resetColumnSettings();
    this.closeResetConfirm();
    this.closeColumnSettings();
  }

  resetColumnSettings(): void {
    if (!this.gridApi) return;
    if (this.initialColumnState.length) {
      this.gridApi.applyColumnState({ state: this.initialColumnState, applyOrder: true });
    } else {
      this.gridApi.resetColumnState();
    }
    this.stateService.clear(this.resolvedGridId);
    this.userColumnStateActive = false;
    this.scheduleFitColumns();
    this.columnSettingsDraft = this.buildColumnSettings();
    this.cdr.markForCheck();
  }

  // Commits the working copy to AG Grid in one batch: order first, then visibility,
  // then a single persist. Until this runs the grid is untouched (drag/hide edit the
  // draft only) — so Cancel/close simply discards the draft.
  applyColumnSettings(): void {
    if (!this.gridApi) return;
    this.applyColumnOrderFromDraft();
    const show = this.columnSettingsDraft.filter(s => s.visible).map(s => s.colId);
    const hide = this.columnSettingsDraft.filter(s => !s.visible).map(s => s.colId);
    if (show.length) this.gridApi.setColumnsVisible(show, true);
    if (hide.length) this.gridApi.setColumnsVisible(hide, false);
    this.userColumnStateActive = true;
    this._persistState();
    this.gridApi.sizeColumnsToFit();
    this.closeColumnSettings();
  }

  // ─── Public API ───────────────────────────────────────────────────────────────

  refresh(): void { this.refreshGridData(false); }

  getSelectedRows(): TData[] { return this.gridApi?.getSelectedRows() ?? []; }

  getGridApi(): GridApi<TData> | undefined { return this.gridApi; }

  setStaticData(data: TData[]): void {
    this.ResolveDataSource = { ...this.ResolveDataSource, data };
    if (this.gridApi) {
      this.gridApi.setGridOption('rowData', data);
      this.totalRowCount = data.length;
    }
  }
  stopEditing(): void { this.gridApi?.stopEditing(); }

  clearSelection(): void {
    this._persistedSelectionIds.clear();
    this.selectAllActive = false;
    this.gridApi?.deselectAll();
  }

  exportToCsv(filename?: string): void {
    this.gridApi?.exportDataAsCsv({ fileName: filename || `${this.ResolveToolbar.headerTitle || 'export'}.csv` });
  }

  refreshGridData(_purgeCache = false): void {
    if (!this.gridApi) return;
    switch (this.dataSourceStrategy) {
      case 'static':
      case 'customApi':
        this.gridApi.setGridOption('rowData', this.ResolveDataSource.data);
        this.totalRowCount = this.ResolveDataSource.data.length;
        return;

      case 'api':
      case 'odata':
      default:
        this.fetchCancel$.next();
        this.knownRowCount = undefined;
        this.blockCache.clear();
        this.selectAllActive = false;
        this.gridApi.setGridOption('loading', true);
        this.loadRows();
        return;
    }
  }

  resetGridState(): void {
    if (!this.gridApi) return;
    this.searchText = '';
    this.activeSegment = 'all';
    this.columnOdataFilters.clear();
    this.stateService.clear(this.resolvedGridId);
    this.gridApi.setFilterModel(null);
    if (this.initialColumnState.length) {
      this.gridApi.applyColumnState({ state: this.initialColumnState, applyOrder: true });
    } else {
      this.gridApi.resetColumnState();
    }
    // Cleared persisted layout → re-enable auto-fit.
    this.userColumnStateActive = false;
    this.scheduleFitColumns();
    this.refreshGridData(true);
  }

  // ─── Getters ──────────────────────────────────────────────────────────────────

  get resolvedGridId(): string {
    return this.gridId || this.keyForCacheCustomDataTableColumns ||
           this.ResolveDataSource.endpoint || this.ResolveDataSource.customEndpoint || 'ag-grid-default';
  }

  get resolvedSelectionMode(): 'single' | 'multiple' | undefined {
    if (this.selectionMode === 'Single') return 'single';
    if (this.selectionMode === 'Multiple') return 'multiple';
    return undefined;
  }

  get resolvedRowHeight(): number {
    return this.ResolveDisplay.rowHeight ?? (this.ResolveDisplay.isCozy ? 44 : 32);
  }

  // Single source of truth for how rows are loaded — derived ONLY from the resolved
  // config, never re-derived ad-hoc downstream. `type:'api'` is honoured explicitly and
  // never falls back to OData.
  //  - static    → client-side, rows from dataSource.data
  //  - customApi  → client-side, parent supplies rows (onLoadMoreForCustomAPI)
  //  - api        → client-side, GET customEndpoint via the API client (no OData params/prefix)
  //  - odata      → infinite row model + OData query builder
  get dataSourceStrategy(): 'static' | 'customApi' | 'api' | 'odata' {
    if (this.isTreeTable) return 'static';
    const ds = this.ResolveDataSource;
    if (ds.staticData) return 'static';
    if (ds.customApi) return 'customApi';
    if (ds.type === 'api') return 'api';
    return 'odata';
  }

  get resolvedRowModelType(): RowModelType {
    return 'clientSide';
  }

  protected resolvedRowData: TData[] = [];

  get showToolbarSwitch(): boolean {
    return this.showSwitch || this.ShowSwitch;
  }

  get resolvedPaginationPageSize(): number {
    return this.ResolveDataSource.paginationPageSize ?? this.ResolveDataSource.pageSize;
  }

  // ─── Private: datasource ─────────────────────────────────────────────────────

  private buildCombinedFilter(): string | undefined {
    const parts: string[] = [];
    if (this.ResolveDataSource.filter?.trim()) parts.push(this.ResolveDataSource.filter.trim());
    if (this.ResolveDataSource.baseFilter?.trim()) parts.push(this.ResolveDataSource.baseFilter.trim());
    if (this.legacySegmentFilter?.trim()) parts.push(this.legacySegmentFilter.trim());
    if (this.activeSegment === 'active')   parts.push('is_active eq true');
    if (this.activeSegment === 'inactive') parts.push('is_active eq false');
    // Direct-OData column filters (multiSelect header) — already valid $filter fragments
    this.columnOdataFilters.forEach((fragment) => { if (fragment) parts.push(fragment); });
    return parts.length ? parts.join(' and ') : undefined;
  }

  // Called by in-header multiSelect via grid context. Builds the column's OData fragment
  // from its filter model (or clears it), then reloads the datasource with the new $filter.
  setColumnOdataFilter(colId: string, model: any): void {
    const fragment = model
      ? this.queryBuilder.buildColumnFilterExpression(colId, model)
      : '';
    if (fragment) {
      this.columnOdataFilters.set(colId, fragment);
    } else {
      this.columnOdataFilters.delete(colId);
    }
    this.onColumnFilter.emit(this.gridApi?.getFilterModel());
    this.refreshGridData(true);
  }


  // Resolve the endpoint + HttpParams for a block fetch. Centralises the OData query
  // building, the $count-skip on pages 2+, and the $search= override so the OData
  // datasource, its synchronous cache probe, and the API datasource stay in lockstep.
  private buildFetchParams(
    request: AgGridTableFetchRequest<TData>,
  ): { endpoint: string; params: HttpParams } {
    const endpoint = (this.ResolveDataSource.customEndpoint || this.ResolveDataSource.endpoint || '').replace(/^\//, '');

    const config: AgGridTableODataSourceConfig = {
      type: this.ResolveDataSource.type === 'api' ? 'api' : 'odata',
      endpoint,
      pageSize: this.ResolveDataSource.pageSize,
      expand: this.ResolveDataSource.expand?.replace(/^\$expand=/, '').trim() || undefined,
      searchFields: this.ResolveDataSource.serverSearch ? [] : this.ResolveDataSource.searchFields,
      additionalFilter: this.buildCombinedFilter(),
    };

    let params = this.queryBuilder.buildOdataParams(request, config);

    // Skip $count on pages 2+ — total is already known from the first block.
    if (request.startRow > 0 && this.knownRowCount !== undefined) {
      params = params.delete('$count');
    }

    // Nav-property sortBy (e.g. 'employee.last_name') is skipped by buildSortQuery
    // because lodata.io rejects $orderby on nav paths from dynamic sort model.
    // Re-apply it here as a static $orderby when no direct-field sort is active.
    const sortByField = this.ResolveDataSource.sortBy?.replace(/\./g, '/');
    if (sortByField?.includes('/') && !params.has('$orderby')) {
      params = params.set('$orderby', `${sortByField} ${this.ResolveDataSource.sortDirection ?? 'asc'}`);
    }

    // $search= mode instead of contains().
    if (this.ResolveDataSource.serverSearch && this.searchText?.trim()) {
      params = new HttpParams({ fromString: params.toString() }).set('$search', this.searchText.trim());
    }

    return { endpoint, params };
  }

  // Block-cache key: endpoint + params minus $count ($count doesn't affect row data).
  // delete() returns a clone, so the caller's params keep $count for the live request.
  private blockCacheKey(endpoint: string, params: HttpParams): string {
    return `${endpoint}?${params.delete('$count').toString()}`;
  }

  private async resolveRows(
    request: AgGridTableFetchRequest<TData>,
  ): Promise<AgGridTableResult<TData> | null> {
    if (this.ResolveDataSource.staticData) return { rows: this.ResolveDataSource.data, total: this.ResolveDataSource.data.length };

    const { endpoint, params: odataParams } = this.buildFetchParams(request);
    if (!endpoint) return { rows: [], total: 0 };

    // Search / column filters must always hit the server fresh — caching them risks
    // serving stale results once the underlying data changes between identical queries.
    const isFiltered = !!(
      this.searchText?.trim() ||
      this.columnOdataFilters.size ||
      (request.filterModel && Object.keys(request.filterModel).length)
    );

    // Block cache — key excludes $count (doesn't affect row data)
    const cacheKey = this.blockCacheKey(endpoint, odataParams);
    if (!isFiltered) {
      const cached = this.blockCache.get(cacheKey);
      if (cached) {
        if (this.knownRowCount === undefined) this.knownRowCount = cached.total;
        return cached;
      }
    }

    // Race HTTP call against fetchCancel$ — returns null when cancelled
    const isOdata = this.ResolveDataSource.type !== 'api';
    const response: any = await firstValueFrom(
      (this.commonService.get<any>(endpoint, isOdata, false, odataParams) as any).pipe(
        takeUntil(merge(this.fetchCancel$, this.destroy$)),
      ),
      { defaultValue: null },
    );

    if (response === null) return null; // request was cancelled

    const rows = this.ResolveDataSource.fromCustomPaginator
      ? (response?.data ?? response?.value ?? [])
      : (this.ResolveDataSource.resultField ? response?.[this.ResolveDataSource.resultField] : (response?.value ?? []));

    const total = this.knownRowCount !== undefined && request.startRow > 0
      ? this.knownRowCount
      : (this.ResolveDataSource.fromCustomPaginator
          ? (response?.total ?? rows.length)
          : (response?.['@odata.count'] ?? response?.['@count'] ?? rows.length));

    if (this.knownRowCount === undefined) this.knownRowCount = total;

    const result: AgGridTableResult<TData> = { rows, total };

    if (!isFiltered) {
      // Evict oldest entry when at capacity, then store
      if (this.blockCache.size >= this.BLOCK_CACHE_MAX) {
        this.blockCache.delete(this.blockCache.keys().next().value!);
      }
      this.blockCache.set(cacheKey, result);
    }

    return result;
  }

  // ─── Private: client-side row fetch ──────────────────────────────────────────
  // Fetches all data from the API, stores in resolvedRowData, and lets AG Grid
  // handle sorting / filtering / search client-side on the loaded set.
  private async loadRows(): Promise<void> {
    if (!this.gridApi) return;

    this.fetchCancel$.next();
    this.knownRowCount = undefined;
    this.blockCache.clear();
    this.currentSkip = 0;
    this.allRowsLoaded = false;
    this.isFetchingMore = false;
    this.isGridLoading = true;
    this.resolvedRowData = [];
    this.gridApi.setGridOption('loading', true);
    this.cdr.markForCheck();

    const request: AgGridTableFetchRequest<TData> = {
      startRow: 0,
      endRow: this.SCROLL_PAGE_SIZE,
      sortModel: (this.gridApi?.getColumnState() ?? [])
        .filter(s => s.sort != null)
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
        .map(s => ({ colId: s.colId!, sort: s.sort as 'asc' | 'desc' })),
      filterModel: this.gridApi?.getFilterModel() ?? {},
      searchText: this.searchText,
      columns: this.columns,
    };

    try {
      const result = await this.resolveRows(request);
      if (result === null) return; // cancelled

      this.resolvedRowData = result.rows;
      this.totalRowCount = result.total;
      this.currentSkip = result.rows.length;
      this.allRowsLoaded = result.rows.length >= result.total;
      this.processData.emit([result.rows]);
      this.dataLoaded.emit(result.total);
      this.isGridLoading = false;
      this.gridApi?.setGridOption('loading', false);
      this.schedulePlaceholderUpdate();
      this.cdr.markForCheck();
    } catch (err) {
      console.error('[AgGridTable] load failed', err);
      this.isGridLoading = false;
      this.gridApi?.setGridOption('loading', false);
      this.cdr.markForCheck();
    }
  }

  private async loadMoreRows(): Promise<void> {
    if (!this.gridApi || this.allRowsLoaded || this.isFetchingMore || this.isGridLoading) return;

    this.isFetchingMore = true;
    this.cdr.markForCheck();

    const request: AgGridTableFetchRequest<TData> = {
      startRow: this.currentSkip,
      endRow: this.currentSkip + this.SCROLL_PAGE_SIZE,
      sortModel: (this.gridApi?.getColumnState() ?? [])
        .filter(s => s.sort != null)
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0))
        .map(s => ({ colId: s.colId!, sort: s.sort as 'asc' | 'desc' })),
      filterModel: this.gridApi?.getFilterModel() ?? {},
      searchText: this.searchText,
      columns: this.columns,
    };

    try {
      const result = await this.resolveRows(request);
      if (result === null) {
        this.isFetchingMore = false;
        this.cdr.markForCheck();
        return;
      }

      this.resolvedRowData = [...this.resolvedRowData, ...result.rows];
      this.currentSkip += result.rows.length;
      this.allRowsLoaded = this.resolvedRowData.length >= this.totalRowCount;
      this.isFetchingMore = false;
      this.moreRowsLoaded.emit([result.rows]);
      this.schedulePlaceholderUpdate();
      this.cdr.markForCheck();
    } catch (err) {
      console.error('[AgGridTable] load more failed', err);
      this.isFetchingMore = false;
      this.cdr.markForCheck();
    }
  }

  protected onGridBodyScroll(event: BodyScrollEvent): void {
    if (event.direction !== 'vertical' || this.allRowsLoaded || this.isFetchingMore || this.isGridLoading) return;
    // Pixel-distance-to-bottom, not row-index — getLastDisplayedRowIndex() can
    // undershoot resolvedRowData.length - 10 right at the true scroll max (viewport-
    // height/row-height dependent), and once scrollTop is maxed no further scroll
    // event ever fires with a new position, permanently stalling the load.
    const viewport = this.el.nativeElement.querySelector('.ag-body-viewport') as HTMLElement | null;
    if (!viewport) return;
    const distanceToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight;
    if (distanceToBottom <= this.SCROLL_TRIGGER_THRESHOLD_PX) {
      this.loadMoreRows();
    }
  }

  // ─── Private: API source (type:'api') ─────────────────────────────────────────
  // Infinite row model — uses the same query builder as the custom-grid-table's
  // ─── Private: column building ─────────────────────────────────────────────────

  private buildColumnDefs(): ColDef<TData>[] {
    return this.buildRawColumnDefs().map((col) => this.withPlaceholderGuards(col));
  }

  // Wrap a column so placeholder (pinned-bottom filler) cells render blank and are
  // never editable, while real rows keep their original renderer/editor behaviour.
  private withPlaceholderGuards(col: ColDef<TData>): ColDef<TData> {
    const origEditable = (col as any).editable;
    const origSelector = col.cellRendererSelector;
    const origRenderer = col.cellRenderer;
    const origParams = col.cellRendererParams;
    return {
      ...col,
      editable: (p: any) => {
        if (p?.node?.rowPinned) return false;
        return typeof origEditable === 'function' ? origEditable(p) : !!origEditable;
      },
      cellRendererSelector: (p: any) => {
        if (p?.node?.rowPinned) return { component: this.blankCellRenderer };
        if (origSelector) return origSelector(p);
        if (origRenderer) return { component: origRenderer, params: origParams };
        return undefined; // fall back to AG's default text renderer
      },
    };
  }

  private buildRawColumnDefs(): ColDef<TData>[] {
    const selectionCol: ColDef<TData>[] = this.selectionMode === 'Multiple' ? [{
      colId: '__selection__',
      headerName: '',
      width: 70,
      minWidth: 60,
      maxWidth: 70,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      lockPosition: 'left',
      pinned: 'left',
      ...(this.isTreeTable
        ? {
            // Custom tri-state checkbox: groups show checked/indeterminate/unchecked
            // computed from children; leaves are binary. AG Grid selection tracks leaves only.
            cellRenderer: AgGridTreeCheckboxCellRendererComponent,
            cellRendererParams: {
              getGroupState: (groupId: string) => this.getTreeGroupState(groupId),
              onGroupToggle: (groupId: string, checked: boolean) =>
                this.toggleTreeGroupChildren(groupId, checked),
              onLeafToggle: (node: any, checked: boolean) =>
                node.setSelected(checked, false, 'checkboxSelected'),
              isDisabled: (data: any) =>
                this.disableColumnRule ? this.disableColumnRule(data) : false,
            },
          }
        : { checkboxSelection: true }),
    }] : [];

    const treeCol: ColDef<TData>[] = this.isTreeTable ? [{
      colId: '__tree__',
      headerName: $localize`Modules Name`,
      field: 'name' as any,
      minWidth: 220,
      flex: 1,
      sortable: false,
      filter: false,
      resizable: false,
      suppressMovable: true,
      lockVisible: true,
      suppressHeaderMenuButton: true,
      cellRenderer: AgGridTreeCellRendererComponent,
      cellRendererParams: {
        onToggle: (groupId: string) => this.toggleTreeGroup(groupId),
        isExpanded: (groupId: string) => this._expandedTreeGroups.has(groupId),
      },
    } as ColDef<TData>] : [];

    const base = (this.columns || []).map((col) => {
      // isSelected is an alias for initiallyVisible (false = hidden initially)
      const effectiveVisible = typeof col.isSelected === 'boolean' ? col.isSelected
        : typeof col.initiallyVisible === 'boolean' ? col.initiallyVisible : undefined;

      let normalized: AgGridTableColumn<TData> = {
        ...col,
        hide: effectiveVisible !== undefined ? !effectiveVisible : col.hide,
        cellRenderer: col.Cell
          ? (params: any) => col.Cell!({ value: params.value, row: params.data })
          : col.cellRenderer,
      };
      normalized = this.applyDataTypeToColumn(normalized);
      normalized = this.applyEditorToColumn(normalized);
      normalized = this.applyInlineEditorToColumn(normalized);
      normalized = this.applyFilterControlToColumn(normalized);
      // Nav-property columns (colId contains '.') map to OData paths (employee/last_name).
      // lodata.io rejects dynamic $orderby on nav paths, so disable interactive sort —
      // ordering is handled via the static sortBy config instead.
      const effectiveId = (normalized.colId ?? normalized.field as string ?? '');
      if (effectiveId.includes('.')) {
        normalized = { ...normalized, sortable: false };
      }
      return normalized;
    });

    if (!this.showAction || !this.editPermission) return [...selectionCol, ...treeCol, ...base];

    const actions: AgGridTableRowAction<TData>[] = [];

    if (this.showEditButton) {
      actions.push({
        id: 'edit', label: '', icon: 'edit', tooltip: $localize`Edit`, design: 'Transparent',
        disabled: this.editDisabledFn ? (row: TData) => this.editDisabledFn!(row) : undefined,
      });
    }
    if (this.showInfoButton) {
      actions.push({ id: 'info', label: '', icon: 'information', tooltip: $localize`Info`, design: 'Transparent' });
    }
    if (this.showDeleteButton) {
      actions.push({
        id: 'delete', label: '', icon: 'delete', tooltip: $localize`Delete`, design: 'Negative',
        disabled: this.deleteDisabledFn ? (row: TData) => this.deleteDisabledFn!(row) : undefined,
      });
    }
    (this.customActionButtons || []).forEach((btn: AgGridCustomButton) => {
      actions.push({
        id: btn.id || btn.text || '',
        label: btn.text || '',
        icon: btn.icon,
        tooltip: btn.tooltip || btn.text,
        design: btn.design || 'Transparent',
        visible: btn.hide ? (row: TData) => !btn.hide!(row) : undefined,
        disabled: btn.disable ? (row: TData) => btn.disable!(row) : undefined,
      });
    });

    if (!actions.length) return [...selectionCol, ...treeCol, ...base];

    return [
      ...selectionCol,
      ...treeCol,
      ...base,
      {
        colId: '__actions__',
        headerName: $localize`Action`,
        pinned: 'right',
        lockPinned: true,
        lockVisible: true,
        suppressMovable: true,
        sortable: false,
        filter: false,
        resizable: false,
        suppressSizeToFit: true,   // fixed width — excluded from sizeColumnsToFit distribution
        minWidth: Math.max(100, 40 + actions.length * 40),
        width: Math.max(100, 40 + actions.length * 44),
        cellRenderer: AgGridActionCellRendererComponent,
        cellRendererParams: {
          actions,
          onAction: (actionId: string, row: TData) => this.dispatchRowAction(actionId, row),
        },
      } as ColDef<TData>,
    ];
  }

  private dispatchRowAction(actionId: string, row: TData): void {
    const customBtn = this.customActionButtons.find(b => (b.id || b.text) === actionId);
    if (customBtn?.onClick) {
      customBtn.onClick(row);
      this.rowAction.emit({ actionId, row });
      return;
    }

    switch (actionId) {
      case 'edit':
        this.editClick.emit(row);
        break;
      case 'delete':
        this.deleteClick.emit(row);
        this.deleteClickNew.emit(row);
        break;
      case 'info':
        this.infoClick.emit(row);
        break;
      default:
        this.rowAction.emit({ actionId, row });
        break;
    }
  }

  // Auto-wire renderer/editor based on legacy dataType
  private applyDataTypeToColumn(column: AgGridTableColumn<TData>): AgGridTableColumn<TData> {
    const dt = column.dataType;
    if (!dt || column.cellRenderer || column.editor) return column;

    switch (dt) {
      case GridTableColumnDataType.Boolean:
        return { ...column, cellRenderer: AgGridBooleanCellRendererComponent, filter: false, sortable: false };

      case GridTableColumnDataType.Checkbox:
        return { ...column, editor: { type: 'checkbox' }, cellRenderer: AgGridBooleanCellRendererComponent };

      case GridTableColumnDataType.InputField:
        return { ...column, editor: { type: 'text', placeholder: column.extraText } };

      case GridTableColumnDataType.NumberField:
        return {
          ...column,
          editor: { type: 'number', min: column.minValue, decimals: column.decimalPlaces },
          type: 'numericColumn',
        };

      case GridTableColumnDataType.IntegerField:
      case GridTableColumnDataType.Integer:
        return { ...column, editor: { type: 'integer', min: column.minValue }, type: 'numericColumn' };

      case GridTableColumnDataType.InputArea:
        return {
          ...column,
          editor: {
            type: 'textarea',
            rows: column.numberOfRows,
            placeholder: column.extraText,
          },
        };

      case GridTableColumnDataType.DropdownSingle:
      case GridTableColumnDataType.UI5elect:
        return {
          ...column,
          editor: {
            type: 'select',
            options: column.comboBoxValues ?? [],
          },
        };

      case GridTableColumnDataType.Number:
        return { ...column, filter: 'agNumberColumnFilter', type: 'numericColumn' };

      case GridTableColumnDataType.Date:
        return {
          ...column,
          filterControl: { type: 'dateRange' },
          valueFormatter:
            column.valueFormatter ??
            (({ value }: any) => (value ? moment(value).format('DD/MM/YYYY') : '')),
        };

      case GridTableColumnDataType.UI5DateRangePicker:
        return { ...column, filterControl: { type: 'dateRange' } };

      case GridTableColumnDataType.TimeStamp:
        return {
          ...column,
          valueFormatter: ({ value }: any) =>
            value ? new Date(value).toLocaleString() : '',
        };

      case GridTableColumnDataType.Time:
        return {
          ...column,
          valueFormatter: ({ value }: any) =>
            value ? String(value).substring(0, 8) : '',
        };

      case GridTableColumnDataType.IconText:
        return {
          ...column,
          cellRenderer: AgGridIconTextCellRendererComponent,
          cellRendererParams: { icon: column.cellIcons?.[0]?.icon, iconPosition: column.iconPosition },
        };

      case GridTableColumnDataType.NestedString:
      case GridTableColumnDataType.MultipleString:
        if (column.accessorArray?.length) {
          return {
            ...column,
            valueGetter: (params: any) => {
              if (!params?.data) return '';
              return (column.accessorArray || [])
                .map((acc: string) => acc.split('.').reduce((obj: any, k: string) => obj?.[k], params.data))
                .filter(Boolean)
                .join(' / ');
            },
          };
        }
        return column;

      case GridTableColumnDataType.NestedInt:
        if (column.accessorArray?.length) {
          return {
            ...column,
            valueGetter: (params: any) => {
              if (!params?.data) return null;
              return column.accessorArray![0].split('.').reduce((obj: any, k: string) => obj?.[k], params.data);
            },
            type: 'numericColumn',
          };
        }
        return column;

      case GridTableColumnDataType.Color:
        return {
          ...column,
          cellRenderer: (params: any) => {
            if (!params.value) return '';
            const div = document.createElement('div');
            div.style.cssText = `display:flex;align-items:center;gap:6px;height:100%`;
            const swatch = document.createElement('span');
            swatch.style.cssText = `display:inline-block;width:16px;height:16px;border-radius:50%;background:${params.value}`;
            const txt = document.createTextNode(params.value);
            div.appendChild(swatch);
            div.appendChild(txt);
            return div;
          },
        };

      default:
        return column;
    }
  }

  private applyEditorToColumn(column: AgGridTableColumn<TData>): AgGridTableColumn<TData> {
    const editor = column.editor;
    if (!editor) return column;
    const base: Partial<ColDef<TData>> = {
      editable: true,
      singleClickEdit: this.singleClickEdit,
      suppressKeyboardEvent: (params) => params.editing,
    };
    return { ...column, ...base, ...this.resolveEditorColDef(editor) };
  }

  // Always-on inline control (ui5 step-input / input) rendered in every row.
  // The control owns its edits — the cell stays non-editable (no click-to-edit).
  private applyInlineEditorToColumn(column: AgGridTableColumn<TData>): AgGridTableColumn<TData> {
    const cfg = column.inlineEditor;
    if (!cfg) return column;

    const field = (column.field as string) ?? column.colId ?? '';
    const renderer =
      cfg.type === 'stepInput'
        ? AgGridStepInputCellRendererComponent
        : AgGridInlineInputCellRendererComponent;

    return {
      ...column,
      editable: false,
      cellRenderer: renderer,
      cellRendererParams: {
        inlineConfig: cfg,
        field,
        onEdit: (row: TData, f: string, newValue: any, oldValue: any) =>
          this.handleInlineEdit(column, row, f, newValue, oldValue),
      },
    };
  }

  private handleInlineEdit(
    column: AgGridTableColumn<TData>,
    row: TData,
    field: string,
    newValue: any,
    oldValue: any,
  ): void {
    column.afterValueChange?.(row, field, newValue, oldValue);
    this.cellEdited.emit({ row, field, newValue, oldValue });
  }

  // All editor types share the unified AgGridCellEditorComponent (it switches on
  // editorConfig.type). Only the per-type colDef flags differ.
  private resolveEditorColDef(editor: AgGridTableEditorConfig): Partial<ColDef<TData>> {
    const base: Partial<ColDef<TData>> = {
      cellEditor: AgGridCellEditorComponent,
      cellEditorParams: { editorConfig: editor },
    };
    switch (editor.type) {
      case 'textarea': return { ...base, cellEditorPopup: true, cellEditorPopupPosition: 'under' };
      case 'select':   return { ...base, cellEditorPopup: true };
      case 'checkbox': return { ...base, cellRenderer: AgGridBooleanCellRendererComponent };
      default:         return base;
    }
  }

  private applyFilterControlToColumn(column: AgGridTableColumn<TData>): AgGridTableColumn<TData> {
    const fc = column.filterControl;
    if (!fc) return column;
    if (fc.type === 'dateRange') return { ...column, filter: 'agDateColumnFilter' };
    return { ...column, filter: 'agTextColumnFilter' };
  }

  // ─── Private: state ───────────────────────────────────────────────────────────

  private saveState(): void { this.saveStateTrigger$.next(); }

  private _persistState(): void {
    if (!this.gridApi) return;
    if (!(this.isBase || this.isTableCacheEnabled)) return;
    this.stateService.save(this.resolvedGridId, {
      columnState: this.gridApi.getColumnState(),
      filterModel: this.gridApi.getFilterModel(),
      searchText: this.searchText,
    });
  }

  private restoreSavedState(): void {
    if (!this.gridApi) return;
    if (!(this.isBase || this.isTableCacheEnabled)) return;
    const saved = this.stateService.load(this.resolvedGridId);
    if (!saved) return;
    this.searchText =  '';
    if (saved.columnState?.length) {
      // Strip persisted sort — only sortBy config drives $orderby. Without this,
      // a previously user-sorted column would restore its sort state and silently
      // inject $orderby into every request on reload.
      const stateToRestore = this.ResolveDataSource.sortBy
        ? saved.columnState.map((s: ColumnState) => ({ ...s, sort: null, sortIndex: null }))
        : saved.columnState;
      // applyColumnState reconciles by colId — columns missing from saved state keep
      // their def defaults, and saved entries for removed columns are ignored. So
      // added/removed columns are handled gracefully without breaking the layout.
      this.gridApi.applyColumnState({ state: stateToRestore, applyOrder: true });
      // User has a persisted layout (order/width/hide/pin) → suppress auto-fit so the
      // restored widths/order survive reload + container resize.
      this.userColumnStateActive = true;
    }
    if (saved.filterModel) this.gridApi.setFilterModel(saved.filterModel);
  }

  private buildColumnSettings(): AgGridTableColumnSetting[] {
    const stateOrder = new Map(
      (this.gridApi?.getColumnState() || []).map((s, i) => [s.colId, i]),
    );
    return (this.gridApi?.getColumns() || [])
      .filter(col => col.getColId() !== '__actions__')
      .sort((a, b) =>
        (stateOrder.get(a.getColId()) ?? 999) - (stateOrder.get(b.getColId()) ?? 999),
      )
      .map(col => {
        const raw: any = col.getColDef().headerName;
        const headerName = typeof raw === 'function'
          ? raw(null)
          : (raw || col.getColId());
        return {
          colId: col.getColId(),
          headerName: String(headerName),
          field: String(col.getColDef().field ?? ''),
          visible: col.isVisible(),
          lockVisible: !!col.getColDef().lockVisible,
        };
      });
  }

  private initCustomSegmentDefaults(): void {
    const defaults: Record<string, string> = {};
    (this.toolbarSegments || []).forEach((g: AgGridToolbarSegmentGroup) => {
      defaults[g.id] = this.segmentValues[g.id] ?? g.defaultValue ?? g.items[0]?.id ?? '';
    });
    this.segmentValues = defaults;
  }

  private initSegmentedState(): void {
    const defaultSeg = this.segmentButtonItems.find(i => i.defaultSelect);
    if (defaultSeg) {
      this.activeSegmentedItem = defaultSeg.id;
      this.legacySegmentFilter = (defaultSeg as any).filter ?? '';
    }
  }

  // ─── Tree table (isTreeTable) ─────────────────────────────────────────────
  private _expandedTreeGroups = new Set<string>();

  protected readonly treeIsExternalFilterPresent = (): boolean => this.isTreeTable;

  protected readonly treeDoesExternalFilterPass = (node: any): boolean => {
    if (!node.data) return true;
    if ((node.data as any)._level !== 1) return true;
    if (this.searchText?.trim()) return true;
    return this._expandedTreeGroups.has(String((node.data as any)._parentId ?? ''));
  };

  toggleTreeGroup(groupId: string): void {
    if (this._expandedTreeGroups.has(groupId)) {
      this._expandedTreeGroups.delete(groupId);
    } else {
      this._expandedTreeGroups.add(groupId);
    }
    this.gridApi?.onFilterChanged();
  }

  private initTreeExpansion(): void {
    this._expandedTreeGroups.clear(); // all groups start collapsed
  }

  // Tri-state for a group from its children's AG selection (hidden/collapsed nodes count too).
  private getTreeGroupState(groupId: string): 'checked' | 'indeterminate' | 'unchecked' {
    const api = this.gridApi;
    if (!api) return 'unchecked';
    let total = 0;
    let selected = 0;
    api.forEachNode((n: any) => {
      if (String(n.data?._parentId ?? '') !== groupId) return;
      total++;
      if (n.isSelected()) selected++;
    });
    if (total === 0 || selected === 0) return 'unchecked';
    if (selected === total) return 'checked';
    return 'indeterminate';
  }

  // Row-body click → same toggle the checkbox performs. Leaf: flip its own selection
  // (additive, never clears siblings). Group: select all children when not already
  // fully checked, else deselect all. Disabled rows are ignored.
  private toggleTreeRowSelection(event: RowClickedEvent<TData>): void {
    const data = event.data as any;
    if (this.disableColumnRule && this.disableColumnRule(event.data!)) return;
    if (data?._level === 0) {
      const groupId = String(data.id ?? data.name ?? '');
      this.toggleTreeGroupChildren(groupId, this.getTreeGroupState(groupId) !== 'checked');
    } else if (event.node) {
      event.node.setSelected(!event.node.isSelected(), false, 'checkboxSelected');
    }
  }

  // Group checkbox toggle → select/deselect all child leaves in one batched event.
  private toggleTreeGroupChildren(groupId: string, checked: boolean): void {
    const api = this.gridApi;
    if (!api) return;
    const nodes: any[] = [];
    api.forEachNode((n: any) => {
      if (String(n.data?._parentId ?? '') === groupId) nodes.push(n);
    });
    if (nodes.length) api.setNodesSelected({ nodes, newValue: checked, source: 'checkboxSelected' });
  }

  // ─── Click tracking for double-click ─────────────────────────────────────────
  private clickCount = 0;
  private clickTimer: ReturnType<typeof setTimeout> | undefined;
}

// ─── Re-exports ───────────────────────────────────────────────────────────────
export type {
  AgGridTableColumn,
  AgGridTableCellEditEvent,
  AgGridTableRowAction,
  AgGridTableRowActionEvent,
  AgGridTableToolbarActionEvent,
  AgGridTableEditorConfig,
} from './types/ag-grid-table.types';

export { GridTableColumnDataType } from './types/ag-grid-table.types';
