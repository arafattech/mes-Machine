# MACHINE_CONFIG_COMPONENT — Component Context

## Overview

| Property | Value |
|---|---|
| **TS file** | `src/app/modules/base-data-management/machine-management/machine-config/machine-config.component.ts` |
| **HTML file** | `src/app/modules/base-data-management/machine-management/machine-config/machine-config.component.html` |
| **Selector** | `app-machine-config` |
| **Component type** | List + Form Dialog (hybrid) |
| **Grid** | `app-ag-grid-table` (converted from `app-custom-grid-table` + `react-analytical-table` / `.tsx`) |
| **Purpose** | Manages full CRUD lifecycle for machine IoT/PLC configurations (`MachineHasConfigs`). Renders an ag-grid listing all configs. Opens a UI5 dialog for create/edit. Deletion delegated to `app-delete-entity` via `IsDelete` EventEmitter. |

---

## Inputs (@Input)

None. All data fetched internally.

---

## Outputs (@Output)

| Output | Type | Purpose |
|---|---|---|
| `refreshTable` | `EventEmitter<any>` | Emitted after save or delete success — signals parent to sync related views |
| `IsDelete` | `EventEmitter<string>` | OData resource path for delete. Formats: `MachineHasConfigs/{id}` (grid row) or `MachineConfigs/{id}` (from `removeSelectedConfiguration()`) |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `permissions` | `typeof Permissions` | `Permissions` | Permission enum ref for template checks |
| `localization` | `typeof Localization` | `Localization` | Localized string utility |
| `valueState` | `typeof ValueState` | `ValueState` | UI5 ValueState enum ref |
| `saveMode` | `string` | `saveMode.POST` | `'POST'` or `'PUT'` — controls dialog header + combobox read-only |
| `open` | `boolean` | `false` | Controls `ui5-dialog` visibility |
| `loading` | `boolean` | `false` | Busy indicator during save |
| `hasExistingMachineConfig` | `boolean` | `false` | Duplicate config guard — set true when API confirms existing config for selected machine (or server returns 422) |
| `duplicateConfigMessage` | `string` | fixed string | Message shown in dialog when duplicate detected |
| `Machines` | `Machine[]` | `[]` | Machine list for combobox — fetched on `ngOnInit` |
| `machineConfig` | `MachineConfig` | empty `MachineConfig` | Form model bound to dialog fields |
| `gridId` | `string` | `'base-data-machine-config'` | ag-grid column state persistence key |
| `columns` | `AgGridTableColumn<any>[]` | from `buildColumns()` | Column defs — built once in constructor |
| `dataSource` | `AgGridTableODataSourceConfig<MachineConfig>` | `{ type:'odata', endpoint:'MachineHasConfigs', searchFields:['machine_name','ip_plc','config_id'], pageSize:40 }` | OData source config |
| `toolbarConfig` | `AgGridTableToolbarConfig` | see code | Title, search, scanner, row count, segment button (All/Active/Inactive), new button |
| `displayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight: 'calc(100vh - 118px)' }` | Grid height config |
| `protocolOptions` | `string[]` | `["HTTP", "HTTPS"]` | Protocol select options |
| `typeOptions` | `string[]` | `["Cast/cast_sig", "Cast", "Signal"]` | Type + Type Selection select options |
| `readFromOptions` | `string[]` | `["CHANNEL", "PLC", "API", "MODBUS"]` | Read From select options |
| `valueStateOptions` | `{ machine_name, ip_plc }` | both `ValueState.None` | Validation feedback per field |

---

## ViewChild

| Ref | Type | Purpose |
|---|---|---|
| `agGridRef` (`#agGridRef`) | `AgGridTableComponent<MachineConfig>` | Calls `refreshGridData(true)` after save/delete |
| `machineNameInput` (`#machineName`) | `any` | Imperatively clears combobox value on `CloseDialog()` |

---

## Lifecycle

- `ngOnInit()` → calls `GetMachines()`

---

## Methods

| Method | Description |
|--------|-------------|
| `GetMachines()` | GET `Machines` (OData) → populates `this.Machines` |
| `newConfig()` | Sets POST mode, resets duplicate flag, opens dialog |
| `editConfig(data)` | Sets PUT mode, deserializes row into `machineConfig`, opens dialog |
| `handleRowSelect(row)` | Row click handler → delegates to `editConfig(row)` |
| `DeleteConfig(row)` | Emits `IsDelete` with `MachineHasConfigs/${row.id}` |
| `removeSelectedConfiguration()` | Emits `IsDelete` with `MachineConfigs/${machineConfig.id}` — defined but not wired to UI |
| `checkValidation(event, field)` | Live validation on combobox/input change for `machine_name` / `ip_plc` |
| `validateForm()` | Requires `machine_id` and `ip_plc` — returns bool |
| `onMachineSelection(event)` | Handles combobox selection; checks for existing config via API (POST mode only) |
| `onSelectChange(field, event)` | Reads `getAttribute('value')` from UI5 select option → assigns to `machineConfig[field]` |
| `onSwitchChange(field, event)` | Reads `event.target.checked` → assigns boolean to `machineConfig[field]` |
| `SaveConfig()` | Validates, POSTs or PUTs, refreshes grid, closes dialog |
| `processData(event?)` | Emits `refreshTable`, calls `agGridRef.refreshGridData(true)` |
| `CloseDialog()` | Resets `open`, `loading`, `hasExistingMachineConfig`, `valueStateOptions`, `machineConfig`, clears combobox |

---

## ag-grid Table Config

| Input | Value |
|-------|-------|
| `url` | `MachineHasConfigs` |
| `searchFields` | `['machine_name', 'ip_plc']` |
| `limit` | `50` |
| `isBase` | `true` |
| `gridHeight` | `calc(100vh - 118px)` |
| `showActiveButton` | `true` (All / Active / Inactive) |
| `showNewButton` | guarded by `BASE_DATA_MACHINE_CONFIG_CREATE` |
| `showEditButton` | guarded by `BASE_DATA_MACHINE_CONFIG_EDIT` |
| `showDeleteButton` | guarded by `BASE_DATA_MACHINE_CONFIG_DELETE` |
| `(editClick)` | `editConfig($event)` |
| `(rowClick)` | `handleRowSelect($event)` |
| `(deleteClick)` | `DeleteConfig($event)` |

---

## Columns

### Visible by default
| Field | Header | Notes |
|-------|--------|-------|
| `is_active` | Active | `AgGridBooleanCellRendererComponent` |
| `machine_name` | Machine Name | |
| `ip_plc` | IP PLC | |
| `protocol` | Protocol | |
| `type` | Type | |
| `read_from` | Read From | |
| `timeout_sec` | Timeout (sec) | numeric |
| `created_at` | Created On | `toLocaleDateString()` |

### Hidden by default (`hide: true`) — migration columns
`config_id`, `id_iot`, `ip_hmi`, `port`, `websocket_port`, `max_rpm`, `min_rpm`, `max_temp`, `min_temp`, `shot_buffer`, `server_call_sec`, `auto_signal`, `shot_signal`, `inverse_auto`, `inverse_shot`, `auto_independent`, `active`, `scrap`, `robot_active`, `robot`, `press_active`, `press`, `handling_active`, `handling`, `selection_type`, `heating_start`, `order_of_machine`, `live_status_api`, `live_shot_api`, `test_status_api`, `test_shot_api`

Boolean hidden columns use `AgGridBooleanCellRendererComponent`. Date `heating_start` uses `toLocaleString()`.

---

## API Calls

| Method | Endpoint | When | Notes |
|--------|----------|------|-------|
| GET | `Machines` (OData) | `ngOnInit` | Populates combobox |
| GET | `MachineHasConfigs?$filter=machine_id eq {id}` | `onMachineSelection()` POST mode | Duplicate check |
| GET | `MachineHasConfigs` | ag-grid auto | Server-side paginated grid data |
| POST | `machine/configs` | `SaveConfig()` POST mode | Create config |
| PUT | `machine/configs/{id}` | `SaveConfig()` PUT mode | Update config |
| DELETE | `MachineHasConfigs/{id}` or `MachineConfigs/{id}` | via `app-delete-entity` | Delete config |

---

## Validation

| Field | Rule | State on failure |
|-------|------|-----------------|
| `machine_id` | Must be non-zero | `valueStateOptions.machine_name = ValueState.Negative` |
| `ip_plc` | Must not be empty | `valueStateOptions.ip_plc = ValueState.Negative` |
| Duplicate config | One config per machine (POST) | `hasExistingMachineConfig = true` → Save blocked + message strip |

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | GET / POST / PUT |
| `ToastService` | Success / error notifications |
| `RolePermissionService` | Permission checks |

---

## Template Components

| Component | Purpose |
|-----------|---------|
| `app-ag-grid-table` | Main data grid |
| `ui5-dialog` | Create/edit form (full-width, `96vw`) |
| `app-delete-entity` | Delete confirmation + HTTP DELETE |

---

## Key Business Logic

- **One config per machine (dual-layer):** Client-side API check on machine selection (POST mode) + server HTTP 422 reactive guard.
- **Machine Name locked in edit:** `[readonly]="saveMode === 'PUT'"` on combobox — machine relationship immutable after create.
- **`removeSelectedConfiguration()`** is implemented but not wired to any UI element.
- **Migration columns** (`id_iot`, `ip_hmi`, ports, RPM/Temp thresholds, API URLs) are read-only grid columns hidden by default — accessible via ag-grid column picker.

---

## Conversion Notes

- Converted from `app-custom-grid-table` + `.tsx` (React/JSX + `CustomGridTableComponent`) to `app-ag-grid-table` + `.ts`.
- `CustomGridTableComponent` `@ViewChild("MachineConfigTable")` replaced by `AgGridTableComponent` `#agGridRef`.
- Old `url`, `columns` (React Table API), `showActiveButton` HTML bindings replaced by `dataSource`, `toolbarConfig`, `displayConfig` (new ag-grid API).
- JSX boolean `Cell` renderers replaced by `AgGridBooleanCellRendererComponent`.
- `tableColum()` (React Table API) replaced by `buildColumns()` returning `AgGridTableColumn[]`.
- `processData()` now calls `agGridRef?.refreshGridData(true)` instead of `machineConfigTable.onFilterAndSorting()`.
- `DeleteConfig(event)` replaced by `deleteClick(id)` — ag-grid passes `$event.id` directly.
- `handleRowSelect()` removed — row click mapped directly to `editConfig($event)`.
- `showSegmentButton: true` in `toolbarConfig` replaces `[showActiveButton]="true"` in old HTML.
- All form/dialog template logic unchanged.
