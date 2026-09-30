import { ColDef, ColumnState, SortModelItem } from 'ag-grid-community';
import { Observable } from 'rxjs';

// ─── Selection ────────────────────────────────────────────────────────────────

export type AgGridTableSelectionMode = 'single' | 'multiple' | 'none';

// ─── Filter option inputs ─────────────────────────────────────────────────────

export interface AgGridTableFilterOption {
  label: string;
  value: string;
}

export type AgGridTableFilterOptionInput =
  | string
  | number
  | {
      id?: string | number | null;
      label?: string | number | null;
      name?: string | number | null;
      text?: string | number | null;
      value?: string | number | null;
      custom_id?: string | number | null;
    };

// ─── Floating filter controls ─────────────────────────────────────────────────

export interface AgGridTableDateRangeFilterControl {
  type: 'dateRange';
  placeholder?: string;
  formatPattern?: string;
  delimiter?: string;
}

export interface AgGridTableSingleSelectFilterControl {
  type: 'singleSelect';
  options: AgGridTableFilterOptionInput[];
  placeholder?: string;
  clearLabel?: string;
}

export interface AgGridTableMultiSelectFilterControl {
  type: 'multiSelect';
  options: AgGridTableFilterOptionInput[];
  placeholder?: string;
}

export type AgGridTableFilterControl =
  | AgGridTableDateRangeFilterControl
  | AgGridTableSingleSelectFilterControl
  | AgGridTableMultiSelectFilterControl;

// ─── Inline editor configs ────────────────────────────────────────────────────

export interface AgGridTableTextEditorConfig {
  type: 'text';
  placeholder?: string;
  maxLength?: number;
}

export interface AgGridTableNumberEditorConfig {
  type: 'number';
  min?: number;
  max?: number;
  decimals?: number;
  placeholder?: string;
}

export interface AgGridTableIntegerEditorConfig {
  type: 'integer';
  min?: number;
  max?: number;
}

export interface AgGridTableTextareaEditorConfig {
  type: 'textarea';
  rows?: number;
  placeholder?: string;
  maxLength?: number;
}

export interface AgGridTableSelectEditorConfig {
  type: 'select';
  options: AgGridTableFilterOptionInput[];
  placeholder?: string;
}

export interface AgGridTableCheckboxEditorConfig {
  type: 'checkbox';
}

export type AgGridTableEditorConfig =
  | AgGridTableTextEditorConfig
  | AgGridTableNumberEditorConfig
  | AgGridTableIntegerEditorConfig
  | AgGridTableTextareaEditorConfig
  | AgGridTableSelectEditorConfig
  | AgGridTableCheckboxEditorConfig;

// ─── Always-on inline controls (rendered in every row, no click-to-edit) ───────

export interface AgGridStepInputInlineConfig {
  type: 'stepInput';
  min?: number;
  max?: number;
  // Resolve max per-row from another row field (dot-path), e.g. 'required_quantity'.
  maxField?: string;
  step?: number;
  disabled?: boolean;
  // Disable the control when the resolved max is 0 or less.
  disabledWhenMaxZero?: boolean;
}

export interface AgGridTextInlineConfig {
  type: 'input';
  placeholder?: string;
  maxLength?: number;
}

export type AgGridInlineEditorConfig =
  | AgGridStepInputInlineConfig
  | AgGridTextInlineConfig;

// ─── Column data type enum (mirrors GridTableColumnDataType) ─────────────────

export enum GridTableColumnDataType {
  String = 'String',
  Date = 'Date',
  Number = 'Number',
  Boolean = 'Boolean',
  NestedString = 'NestedString',
  NestedArray = 'NestedArray',
  Color = 'Color',
  Time = 'Time',
  IconText = 'IconText',
  MultipleString = 'MultipleString',
  MultipleDate = 'MultipleDate',
  Checkbox = 'Checkbox',
  InputField = 'InputField',
  IntegerField = 'IntegerField',
  NumberField = 'NumberField',
  InputArea = 'InputArea',
  DropdownSingle = 'DropdownSingle',
  DropdownMulti = 'DropdownMulti',
  TimeStamp = 'TimeStamp',
  Custom = 'Custom',
  NestedInt = 'NestedInt',
  Integer = 'Integer',
  NumberMinuteToSecond = 'NumberMinuteToSecond',
  UI5elect = 'UI5elect',
  UI5DateRangePicker = 'UI5DateRangePicker',
}

// ─── Combo/MultiSelect toolbar data shape ─────────────────────────────────────

export interface AgGridComboBoxData {
  textAccessor: string;
  idAccessor: string;
  data: any[];
}

export interface AgGridMultiSelectData {
  textAccessor: string;
  idAccessor: string;
  isSelectedAccessor?: string;
  data: any[];
}

// ─── Custom button shape (matches ICustomButton from legacy) ──────────────────

export interface AgGridCustomButton {
  id?: string;
  text?: string;
  icon?: string;
  design?: 'Default' | 'Emphasized' | 'Transparent' | 'Positive' | 'Negative';
  tooltip?: string;
  disable?: (row: any) => boolean;
  hide?: (row: any) => boolean;
  onClick?: (row: any) => void;
}

// ─── Column definition ────────────────────────────────────────────────────────

export interface AgGridTableColumn<TData = any> extends ColDef<TData> {
  initiallyVisible?: boolean;
  // Alias for initiallyVisible — false hides the column from the settings panel initially
  isSelected?: boolean;
  // Custom cell renderer callback — same shape as custom-grid-table's Cell: ({ value, row }) =>
  Cell?: (params: { value: any; row: any }) => string | HTMLElement;
  filterControl?: AgGridTableFilterControl;
  editor?: AgGridTableEditorConfig;
  // Always-on inline control rendered in every row (ui5 step-input / input).
  inlineEditor?: AgGridInlineEditorConfig;
  afterValueChange?: (row: TData, field: string, newValue: any, oldValue: any) => void;
  // Legacy dataType — auto-wires renderer/editor
  dataType?: GridTableColumnDataType;
  // For DropdownSingle/Multi, MultipleString, NestedString
  comboBoxValues?: any[];
  accessorArray?: string[];
  cellIcons?: any[];           // renamed from icons — ColDef.icons is a different type
  iconPosition?: 'left' | 'right';
  // Editor params (legacy style)
  minValue?: number;
  decimalPlaces?: number;
  extraText?: string;
  numberOfRows?: number;
  isRequired?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean | ((row: TData) => boolean);
  onInput?: (row: TData, event: any) => void;
  onSelectChange?: (row: TData) => void;
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────

export interface AgGridTableToolbarAction {
  id: string;
  text: string;
  icon?: string;
  design?: 'Default' | 'Emphasized' | 'Transparent' | 'Positive' | 'Negative';
  disabled?: boolean;
  visible?: boolean;
}

// ─── Toolbar segments ─────────────────────────────────────────────────────────

export interface AgGridToolbarSegmentItem {
  id: string;
  text: string;
}

export interface AgGridToolbarSegmentGroup {
  id: string;
  items: AgGridToolbarSegmentItem[];
  defaultValue?: string;
}

// ─── Toolbar filter controls ──────────────────────────────────────────────────

export interface AgGridToolbarDateFilter {
  id: string;
  type: 'date';
  placeholder?: string;
  formatPattern?: string;
}

export interface AgGridToolbarDateRangeFilter {
  id: string;
  type: 'dateRange';
  placeholder?: string;
  formatPattern?: string;
}

export interface AgGridToolbarSelectFilter {
  id: string;
  type: 'select';
  placeholder?: string;
  clearLabel?: string;
  options: AgGridTableFilterOptionInput[];
  value?: string; // pre-select/keep this option shown as selected (matched against option.value)
}

export interface AgGridToolbarMultiSelectFilter {
  id: string;
  type: 'multiSelect';
  placeholder?: string;
  options: AgGridTableFilterOptionInput[];
}

export interface AgGridToolbarSwitchFilter {
  id: string;
  type: 'switch';
  label?: string;
  defaultChecked?: boolean;
}

export type AgGridToolbarFilter =
  | AgGridToolbarDateFilter
  | AgGridToolbarDateRangeFilter
  | AgGridToolbarSelectFilter
  | AgGridToolbarMultiSelectFilter
  | AgGridToolbarSwitchFilter;

// ─── Toolbar config ───────────────────────────────────────────────────────────

export interface AgGridTableToolbarConfig {
  headerTitle?: string;
  // ── Search ──
  showSearch?: boolean;
  searchPlaceholder?: string;
  isGlobalSearchVisible?: boolean;
  showScanner?: boolean;            // barcode scanner button (was `showSearchScanner`)
  showRowCount?: boolean;           // total count beside title (was `showRowDataCount`)
  // ── Standard buttons ──
  showNewButton?: boolean;
  addButtonText?: string;
  addButtonDisable?: boolean;
  showRefreshButton?: boolean;
  refButtonText?: string;
  showExtraButton?: boolean;
  extraButtonText?: string;
  extraButtonDesign?: 'Default' | 'Emphasized' | 'Positive' | 'Negative' | 'Transparent' | 'Attention';
  showResetButton?: boolean;
  resetButtonText?: string;
  extraButtonDisable?: boolean;
  showSyncButton?: boolean;
  syncButtonText?: string;
  syncButtonDisable?: boolean;
  showDownload?: boolean;
  disableDownloadButton?: boolean;
  showUpload?: boolean;
  disableUploadButton?: boolean;
  showDeleteButtonInHeader?: boolean;
  deleteButtonText?: string;
  showTripButtons?: boolean;
  clearTrip?: string;
  productionDefaultButtonText?: string;
  showTableSettingBtn?: boolean;
  showValueHelp?: boolean;
  // ── Active / Inactive segmented control ──
  showSegmentButton?: boolean;
  button1Text?: string;
  button2Text?: string;
  button3Text?: string;
  button4Text?: string;
  // ── Advanced (declarative) toolbar controls ──
  actions?: AgGridTableToolbarAction[];
  segments?: AgGridToolbarSegmentGroup[];
  filters?: AgGridToolbarFilter[];
}

// ─── Display / appearance config ──────────────────────────────────────────────

export interface AgGridTableDisplayConfig {
  gridHeight?: string;
  rowHeight?: number;
  headerRowHeight?: number;
  isCozy?: boolean;                 // taller rows when no explicit rowHeight
  alternateRowColors?: boolean;
  fillEmptyRows?: boolean;          // SAP/UI5 inert filler rows below last row
  loadingDelay?: number;
  withRowHighlight?: boolean;
  highlightFieldColumn?: string;
}

// ─── Row actions ──────────────────────────────────────────────────────────────

export interface AgGridTableRowAction<TData = any> {
  id: string;
  label: string;
  icon?: string;
  tooltip?: string;
  design?: 'Default' | 'Emphasized' | 'Transparent' | 'Positive' | 'Negative';
  visible?: (row: TData) => boolean;
  disabled?: (row: TData) => boolean;
}

// ─── Fetch / datasource ───────────────────────────────────────────────────────

export interface AgGridTableFetchRequest<TData = any> {
  startRow: number;
  endRow: number;
  searchText: string;
  sortModel: readonly SortModelItem[];
  filterModel: Record<string, any>;
  columns: AgGridTableColumn<TData>[];
}

export interface AgGridTableResult<TData = any> {
  rows: TData[];
  total: number;
}

export interface AgGridTableODataSourceConfig<TData = any> {
  type: 'odata' | 'api';
  endpoint: string; // OData entity set (was `url`)
  customEndpoint?: string; // overrides endpoint (was `customUrl`)
  pageSize?: number; // block / page size (was `limit`)
  searchFields?: string[];
  expand?: string; // $expand (was `expandQuery`)
  // ── Filtering ──
  filter?: string; // base $filter fragment (was `filterQuery`)
  baseFilter?: string; // extra $filter fragment (was `additionalFilterQuery`)
  additionalFilter?: string; // internal: combined filter passed to the query builder
  // ── Sorting ──
  sortBy?: string;
  sortDirection?: 'asc' | 'desc'; // initial sort (was `customSortType`)
  customSorting?: boolean; // emit `customSorting` instead of OData sort (was `isNewCustomSorting`)
  // ── Pagination ──
  pagination?: boolean;
  paginationPageSize?: number;
  scrollPagination?: boolean;
  // ── Server behaviour ──
  serverSearch?: boolean; // use $search= instead of contains() (was `isServerSearchingEnable`)
  ignoreQueryBuilder?: boolean;
  resultField?: string; // custom result field name (was `customResultFieldName`)
  fromCustomPaginator?: boolean; // response shape {data,total} (was `tookDataFromCustomPaginator`)
  // ── Static / parent-driven data ──
  data?: TData[]; // static row data
  staticData?: boolean; // client-side row model from `data` (was `customData`)
  customApi?: boolean; // parent drives search/fetch (was `isCustomApiCall`)
  customApiManual?: boolean; // suppress auto-reload (was `isCustomApiCalledManually`)
}

export interface AgGridTableCustomDataSourceConfig<TData = any> {
  type: 'custom';
  pageSize?: number;
  fetch: (
    request: AgGridTableFetchRequest<TData>,
  ) =>
    | Observable<AgGridTableResult<TData>>
    | Promise<AgGridTableResult<TData>>;
}

export type AgGridTableDataSourceConfig<TData = any> =
  | AgGridTableODataSourceConfig
  | AgGridTableCustomDataSourceConfig<TData>;

// ─── Persisted state ──────────────────────────────────────────────────────────

export interface AgGridTableStoredState {
  columnState?: ColumnState[];
  filterModel?: Record<string, any>;
  searchText?: string;
  columnSchemaHash?: string;
}

// ─── Events ───────────────────────────────────────────────────────────────────

export interface AgGridTableToolbarActionEvent {
  actionId: string;
  value?: any;   // present for segment + filter events
}

export interface AgGridTableRowActionEvent<TData = any> {
  actionId: string;
  row: TData;
}

export interface AgGridTableCellEditEvent<TData = any> {
  row: TData;
  field: string;
  newValue: any;
  oldValue: any;
}

// ─── Column settings ──────────────────────────────────────────────────────────

export interface AgGridTableColumnSetting {
  colId: string;
  headerName: string;
  field: string;
  visible: boolean;
  lockVisible?: boolean;
}
