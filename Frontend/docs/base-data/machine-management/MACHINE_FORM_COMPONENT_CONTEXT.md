# MACHINE_FORM_COMPONENT — Component Context

## Overview

| Field | Value |
|---|---|
| TS file | `src/app/modules/base-data-management/machine-management/machine-form/machine-form.component.ts` |
| HTML file | `src/app/modules/base-data-management/machine-management/machine-form/machine-form.component.html` |
| Selector | `app-machine-form` |
| Component type | Form (Create / Edit) |
| Purpose | Tabbed card for creating or editing a `Machine` record. Handles core machine data entry (name, group, OEE, boolean flags), inline association of `MachineState`, `Hall`, and `MachineWastageType` records via child associate dialogs, inline creation of a new `MachineGroup` via a child form, and persists the machine then posts its associations to the backend. Uses `app-ag-grid-table` with static data for the state, hall, and wastage-type sub-tables. |

---

## Inputs (@Input)

| Input name | Type | Default | Purpose |
|---|---|---|---|
| `saveMode` | `string` | `"POST"` | Create (`"POST"`) or update (`"PUT"`) mode. Controls the API endpoint, request method, and card header title. |

> `machine`, `MachineState`, `MachineHall`, `MachineWastageType`, `SelectedGroup`, and `open` are set **imperatively** by the parent via `@ViewChild` — they are not `@Input()` bindings.

---

## Outputs (@Output)

| Output name | Event type | Purpose |
|---|---|---|
| `RefreshTable` | `EventEmitter<void>` | Emitted after a successful machine save (and after associate), signalling the parent list to reload. Always emitted **before** `CloseDialog()` is called. |
| `closeFrom` | `EventEmitter<void>` | Emitted at the end of `CloseDialog()` so the parent knows the form panel has been dismissed. |
| `isSuccessChange` | `EventEmitter<void>` | Emitted alongside `RefreshTable` after a confirmed successful save. |

---

## State Properties

| Property | Type | Default | Purpose |
|---|---|---|---|
| `machine` | `Machine` | `new Machine().deserialize({})` | The machine data object bound to Core Data fields. Set by the parent before opening. |
| `machineGroup` | `MachineGroup` | `new MachineGroup()` | Blank instance passed as `[machineGroup]` input to the child `MachineGroupFormComponent`. |
| `selectedTab` | `string` | `"coreData"` | Tracks the active tab (`"coreData"`, `"machineState"`, `"machineHall"`, `"machineWastage"`). Drives `[selected]` on each `<ui5-tab>`. |
| `open` | `boolean` | `false` | Whether the form card is visible. Set to `true` by the parent to open. |
| `loading` | `boolean` | `false` | Drives `<ui5-busy-indicator>` and disables Save/Cancel during an HTTP request. |
| `ToastType` | `"add" \| "edit" \| "error"` | `"add"` | Toast variant shown after save. |
| `validationMessage` | `string` | `Localization.requiredField` | Error shown in `valueStateMessage` slots on invalid fields. |
| `valueState` | `typeof ValueState` | `ValueState` | Provides the `ValueState` namespace to the template. |
| `localization` | `typeof Localization` | `Localization` | i18n string map exposed to the template. |
| `MachineGroup` | `MachineGroup[] \| undefined` | `undefined` | List of `MachineGroup` records loaded from the API; populates the group combobox. |
| `MachineState` | `MachineState[]` | `[]` | Currently selected machine states to associate. |
| `MachineHall` | `Hall[]` | `[]` | Currently selected halls to associate. |
| `MachineWastageType` | `MachineWastageType[]` | `[]` | Currently selected wastage types to associate. Only reachable via the "Machine Wastage" tab, which itself is only rendered (`*ngIf`) when `machine.has_wastage` is on. |
| `defaultStateId` | `number \| null` | `null` | This machine's fallback state (`machine_has_states.is_default`) — the state `ChannelMappingService.deriveStatus` resolves to when no configured channel reads HIGH. Optional, `null` until explicitly picked via the state sub-grid's Default column. |
| `machineTitleGroup` | `string` | `""` | Display name of the selected `MachineGroup`. Bound to the group combobox and validated. |
| `SelectedGroup` | `MachineGroup` | `new MachineGroup().deserialize({})` | Full `MachineGroup` object (id + name). Sent in the association payload. |
| `groupList` | `typeof MachineGroup` | `MachineGroup` (class ref) | Passed as model reference to child associate component. |
| `stateList` | `typeof MachineState` | `MachineState` (class ref) | Passed as `[model]` to the state associate component. |
| `hallList` | `typeof Hall` | `Hall` (class ref) | Passed as `[model]` to the hall associate component. |
| `wastageTypeList` | `typeof MachineWastageType` | `MachineWastageType` (class ref) | Passed as `[model]` to the wastage-type associate component. |
| `valueStateOptions` | `{ name: ValueState, group: ValueState, oee: ValueState }` | All `ValueState.None` | Per-field validation states. |
| `stateDataSource` | `AgGridTableODataSourceConfig<MachineState>` | `{ type:"odata", endpoint:"", staticData:true, data:[] }` | Static data source for the Machine State sub-grid. Spread-reassigned on data change to trigger `ngOnChanges`. |
| `hallDataSource` | `AgGridTableODataSourceConfig<Hall>` | `{ type:"odata", endpoint:"", staticData:true, data:[] }` | Static data source for the Machine Hall sub-grid. Same update mechanism as `stateDataSource`. |
| `wastageTypeDataSource` | `AgGridTableODataSourceConfig<MachineWastageType>` | `{ type:"odata", endpoint:"", staticData:true, data:[] }` | Static data source for the Machine Wastage sub-grid. Same update mechanism as `stateDataSource`. |
| `stateToolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Machine State", showNewButton, addButtonText "Associate", search/rowcount/segment off | Toolbar for the state sub-grid. |
| `hallToolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Machine Hall", same flags | Toolbar for the hall sub-grid. |
| `wastageTypeToolbarConfig` | `AgGridTableToolbarConfig` | headerTitle "Machine Wastage", same flags | Toolbar for the wastage-type sub-grid. |
| `stateDisplayConfig` | `AgGridTableDisplayConfig` | `{ gridHeight:"calc(100vh - 460px)", fillEmptyRows:true }` | Fixed height for the state sub-grid inside the tab. |
| `hallDisplayConfig` | `AgGridTableDisplayConfig` | same as `stateDisplayConfig` | Same for the hall grid. |
| `wastageTypeDisplayConfig` | `AgGridTableDisplayConfig` | same as `stateDisplayConfig` | Same for the wastage-type grid. |
| `stateColumns` | `AgGridTableColumn<MachineState>[]` | Active (boolean renderer), **Default (radio renderer)**, ID, Name, Created On | Column definitions for the state sub-grid. The `is_default` field/column drives `AgGridRadioCellRendererComponent`, `cellRendererParams.onSelect` wired to `onDefaultStateSelect()`. |
| `hallColumns` | `AgGridTableColumn<Hall>[]` | Active (boolean renderer), ID, Name, Created On | Column definitions for the hall sub-grid. |
| `wastageTypeColumns` | `AgGridTableColumn<MachineWastageType>[]` | Active (boolean renderer), ID, Name, Created On | Column definitions for the wastage-type sub-grid — same shape as `hallColumns` (no default/radio concept, unlike `stateColumns`). |

---

## ViewChild / ViewChildren

| Ref name | Type | Template ref | Purpose |
|---|---|---|---|
| `hallAssociateRef` | `AssosiateComponent` | `#hallAssociate` | Opened in `isHallAssociate()`. `bindingData` pre-populated with `MachineHall`. Cleared in `resetForm()`. |
| `stateAssociateRef` | `AssosiateComponent` | `#stateAssociate` | Opened in `isStateAssociate()`. `bindingData` pre-populated with `MachineState`. Cleared in `resetForm()`. |
| `wastageTypeAssociateRef` | `AssosiateComponent` | `#wastageTypeAssociate` | Opened in `isWastageTypeAssociate()`. `bindingData` pre-populated with `MachineWastageType`. Cleared in `resetForm()`. |
| `machineGroupFormRef` | `MachineGroupFormComponent` | `#machineGroupForm` | Opened in `OnAddClickMachineGroup()`. |

---

## Lifecycle Hooks

### `ngOnInit(): void`
Calls `LoadMachineGroup()` to populate the group combobox from the OData API.

---

## Methods — DETAILED

### `checkValidation(event: any, field: string): void`
Real-time validation on `(input)` events.

- `"name"`: empty → `ValueState.Negative`; else assigns `event.target.value` to `machine.machine_name` + `ValueState.None`.
- `"group"`: empty → `ValueState.Negative`, `machineTitleGroup = ""`; else assigns value to `machineTitleGroup` + `ValueState.None`.
- `"oee"`: empty → `ValueState.Negative`; else assigns value to `machine.oee` + `ValueState.None`.

---

### `validateForm(): boolean`
Full form validation before submit. Checks `machine.machine_name?.trim()`, `machineTitleGroup.trim()`, and `machine.oee` (truthy). Sets `ValueState.Negative` and `isValid = false` for each failing field. Returns `isValid`.

---

### `associateTableColum(): { accessor: string }[]`
Returns `[{ accessor: "custom_id" }, { accessor: "name" }]`. Used as `[tableColumn]` on both `app-assosiate` children.

---

### `setMachineState(states: MachineState[]): void`
Public setter called by the parent to load states for edit mode. Assigns `states ?? []` to `MachineState`, then calls `updateStateGrid()`.

In `PUT` mode (edit), also fetches `GET /api/machine/{machine.id}/states` and sets `defaultStateId` from whichever returned row has `is_default: true` — the `Machines?$expand=states` OData path this method's `states` argument came from doesn't expose pivot data (Lodata doesn't surface `belongsToMany` pivot columns through a plain expand), so pre-populating the current default on edit needs this separate dedicated read. Calls `updateStateGrid()` again once the response resolves. Falls back to `defaultStateId = null` on error.

### `onDefaultStateSelect(row: MachineState): void`
Handler for the state sub-grid's Default radio column. Sets `defaultStateId = row.id ?? null` and calls `updateStateGrid()` so only the selected row's radio shows checked.

---

### `setMachineHall(halls: Hall[]): void`
Public setter called by the parent to load halls for edit mode. Assigns `halls ?? []` to `MachineHall`, then calls `updateHallGrid()`.

---

### `setMachineWastageType(wastageTypes: MachineWastageType[]): void`
Public setter called by the parent to load wastage types for edit mode. Assigns `wastageTypes ?? []` to `MachineWastageType`, then calls `updateWastageTypeGrid()`. No separate pivot-flag fetch needed (unlike `setMachineState()`) — this pivot has no `is_default`-equivalent extra column, so the plain `Machines?$expand=machinewastagetypes` OData path is sufficient.

---

### `updateStateGrid(): void` (private)
Rebuilds `stateDataSource.data` as **fresh `MachineState` instances** (not just a fresh array) with `is_default` baked onto each row from the current `defaultStateId`, then spread-reassigns `stateDataSource`.

```typescript
const rows = this.MachineState.map((s) =>
  new MachineState().deserialize({ ...s, is_default: s.id === this.defaultStateId }),
);
this.stateDataSource = { ...this.stateDataSource, data: rows };
```

**Why fresh row objects, not just a fresh array:** the Default column's checked state depends on `defaultStateId`, a value external to the row data. An earlier version read it via `valueGetter: (p) => p.data?.id === this.defaultStateId` instead of a plain `field`, which is unreliable for exactly this kind of externally-driven value — baking `is_default` directly onto a genuinely new `MachineState` instance on every `updateStateGrid()` call means AG Grid always sees real, changed row *data* (not just a changed array reference) and calls each cell renderer's `refresh(params)` with the correct `params.value`.

**Real bug found and fixed (2026-07-16): `AgGridRadioCellRendererComponent` never visually updated despite correct data.** After the fix above, the default still didn't show as checked on edit-load. Root-caused via direct browser inspection (`ng.getComponent()` on the renderer instance vs. reading the underlying `ui5-radio-button` DOM element's own `.checked` property): AG Grid's row node, the parent component's `defaultStateId`, and even the renderer's own `checked` class field were all **correctly** `true` — but the rendered custom element's `.checked` stayed `false`. Cause: the renderer is `ChangeDetectionStrategy.OnPush`, and `refresh()` mutated `this.checked` directly (a plain field, not a bound `@Input()`, and not triggered by a template event) without calling `ChangeDetectorRef.markForCheck()` — so Angular never re-checked the view and never pushed the new value to the DOM, even though every layer of application state was already correct. Fixed by injecting `ChangeDetectorRef` and calling `this.cdr.markForCheck()` at the end of `refresh()`, matching the same pattern already used by `AgGridTreeCellRendererComponent`/`AgGridQtyStepperCellRendererComponent` in the same file — any future `OnPush` cell renderer whose `refresh()` mutates a plain field (not an `@Input`) needs this same call, or it silently won't render.

---

### `updateHallGrid(): void` (private)
Same pattern as `updateStateGrid()` but for `hallDataSource`.

---

### `updateWastageTypeGrid(): void` (private)
Same pattern as `updateHallGrid()` but for `wastageTypeDataSource` — plain fresh array, no external-state baking needed (no `is_default`-equivalent).

---

### `isHallAssociate(): void`
Sets `hallAssociateRef.open = true` and `hallAssociateRef.bindingData = this.MachineHall`.

---

### `isStateAssociate(): void`
Sets `stateAssociateRef.open = true` and `stateAssociateRef.bindingData = this.MachineState`.

---

### `isWastageTypeAssociate(): void`
Sets `wastageTypeAssociateRef.open = true` and `wastageTypeAssociateRef.bindingData = this.MachineWastageType`.

---

### `GetSelectedState(items: MachineState[]): void`
Called by `(selectedData)` on `#stateAssociate`. Assigns `items` to `MachineState` and calls `updateStateGrid()`.

---

### `GetSelectedHall(items: Hall[]): void`
Called by `(selectedData)` on `#hallAssociate`. Assigns `items` to `MachineHall` and calls `updateHallGrid()`.

---

### `GetSelectedWastageType(items: MachineWastageType[]): void`
Called by `(selectedData)` on `#wastageTypeAssociate`. Assigns `items` to `MachineWastageType` and calls `updateWastageTypeGrid()`.

---

### `RemoveMachineState(item: MachineState): void`
Filters `MachineState` excluding `item.id` (strict `!==`), reassigns. If the removed row was the current default (`item.id === defaultStateId`), resets `defaultStateId = null` — a removed state can't stay the default (the backend 422s on a `default_state_id` not present in the submitted `machinestate` list). Then calls `updateStateGrid()`.

---

### `RemoveMachineHall(item: Hall): void`
Filters `MachineHall` excluding `item.id`, reassigns, and calls `updateHallGrid()`.

> Both remove methods now use the same spread-reassign pattern — no imperative `staticData.emit()` / `render()` calls needed.

---

### `RemoveMachineWastageType(item: MachineWastageType): void`
Filters `MachineWastageType` excluding `item.id`, reassigns, and calls `updateWastageTypeGrid()`. Same pattern as `RemoveMachineHall()`.

---

### `LoadMachineGroup(): void`
GET `/odata/MachineGroups?$orderby=id desc&$filter=is_active eq true`. On success assigns `response.value` to `MachineGroup`. On error shows error toast.

---

### `getGroup(items: any): void`
Handles `(selection-change)` from the group combobox. Extracts `id` and `name` from `items.detail.item`, deserializes a `MachineGroup`, sets `machineTitleGroup`, and calls `checkValidation(..., "group")` to clear the error state.

---

### `AddMachine(): void`
Main save handler.

1. Calls `validateForm()`. If invalid, sets `selectedTab = "coreData"` and returns.
2. Sets `loading = true`.
3. Builds `request$`: POST to `Machines` (new) or PUT to `Machines(${machine.id})` (edit).
4. On success:
   - `machine.deserialize(res)` — captures server-assigned `id`.
   - Shows toast.
   - If any of `MachineState.length > 0`, `SelectedGroup.id`, `MachineHall.length > 0`, `MachineWastageType.length > 0` → calls `Associate(machine.id)`.
   - Else: **`RefreshTable.emit()` → `isSuccessChange.emit()` → `CloseDialog()`** (emit order matters — panel collapses only after refresh is triggered).
5. On error: calls `CloseDialog()`, shows error toast.

---

### `Associate(id: number | undefined): void`
Posts machine associations.

Payload:
```typescript
{
  machine_id: id,
  machinestate: this.MachineState,
  machinehall: this.MachineHall,
  machinegroup: Array.isArray(this.SelectedGroup) ? this.SelectedGroup : [this.SelectedGroup],
  default_state_id: this.defaultStateId,
  machinewastagetype: this.MachineWastageType
}
```

`default_state_id` is optional (`null` if never picked) — the backend (`MachineController::machineAssociate`) validates it's one of the ids in `machinestate` and syncs `machine_has_states.is_default` accordingly, 422ing otherwise.

`commonService.post("machine/associate", data, false)` (REST API prefix, not OData).

- On success: **`RefreshTable.emit()` → `isSuccessChange.emit()` → `CloseDialog()`**.
- On error: shows error toast → `CloseDialog()`.

> **Refresh-before-close ordering is critical.** `CloseDialog()` emits `closeFrom`, which causes the parent to call `cancelEdit()` and set `isTabCollapsed = true` (collapsing the right panel). If `RefreshTable` were emitted after panel collapse, the grid refresh would fire during a layout change, causing inconsistent reloads.

---

### `onTabSelect(event: any): void`
Assigns `event.detail.tab.id` to `selectedTab`.

---

### `OnAddClickMachineGroup(): void`
Sets `machineGroupFormRef.open = true`.

---

### `autoGroupAdded(newGroup: MachineGroup): void`
Called on `(groupAdded)` from `MachineGroupFormComponent`.

1. Prepends `newGroup` to `MachineGroup` array.
2. Deserializes `SelectedGroup` from `{ id: newGroup.id, name: newGroup.name }`.
3. Sets `machine.machinegroups = [this.SelectedGroup]`.
4. Sets `machineTitleGroup = newGroup?.name ?? ""`.

---

### `resetForm(): void`
Full form reset. Called internally by `CloseDialog()` and by the parent before opening the form for a new record.

1. `selectedTab = "coreData"`.
2. `machine = new Machine().deserialize({})`.
3. Resets all three `valueStateOptions` to `ValueState.None`.
4. `MachineState = []`, `MachineHall = []`, `MachineWastageType = []`, `defaultStateId = null`.
5. `SelectedGroup = new MachineGroup().deserialize({})`, `machineTitleGroup = ""`.
6. `stateAssociateRef.bindingData = []`, `hallAssociateRef.bindingData = []`, `wastageTypeAssociateRef.bindingData = []`.
7. `updateStateGrid()`, `updateHallGrid()`, `updateWastageTypeGrid()`.

---

### `resetValuState(): void`
Resets all three `valueStateOptions` to `ValueState.None`. Available for external (parent) call if needed.

---

### `CloseDialog(): void`
1. `open = false`.
2. `loading = false`.
3. `resetForm()`.
4. `closeFrom.emit()`.

---

## Template Bindings & Structure

```
<ui5-card class="medium">
  <ui5-card-header [titleText]="saveMode === 'POST' ? localization.New : localization.Edit">
  <ui5-busy-indicator [active]="loading" size="M" [delay]="0">
    <ui5-tabcontainer (tab-select)="onTabSelect($event)">

      <ui5-tab id="coreData" [selected]="selectedTab === 'coreData'">
        5x ui5-switch (is_active, has_rpm, has_config, has_temperature, has_wastage)
        ui5-input [(ngModel)]="machine.machine_name"   (input)="checkValidation($event, 'name')"
        ui5-combobox [value]="machineTitleGroup"        (selection-change)="getGroup($event)"
          *ngFor MachineGroup → ui5-cb-item
          ui5-button "add" (click)="OnAddClickMachineGroup()"
        ui5-input type="Number" [(ngModel)]="machine.oee" (input)="checkValidation($event, 'oee')"

      <ui5-tab id="machineState" [selected]="selectedTab === 'machineState'">
        <app-ag-grid-table
          [columns]="stateColumns"
          [dataSource]="stateDataSource"
          [toolbarConfig]="stateToolbarConfig"
          [displayConfig]="stateDisplayConfig"
          [showAction]="true" [editPermission]="true"
          [showEditButton]="false" [showDeleteButton]="true"
          [showIllustratedMessage]="true" IllustratedName="NoData"
          (newButtonClick)="isStateAssociate()"
          (deleteClick)="RemoveMachineState($event)">

      <ui5-tab id="machineHall" [selected]="selectedTab === 'machineHall'">
        <app-ag-grid-table
          [columns]="hallColumns"
          [dataSource]="hallDataSource"
          [toolbarConfig]="hallToolbarConfig"
          [displayConfig]="hallDisplayConfig"
          same action/delete config as machineState tab
          (newButtonClick)="isHallAssociate()"
          (deleteClick)="RemoveMachineHall($event)">

      <ui5-tab *ngIf="machine.has_wastage" id="machineWastage" [selected]="selectedTab === 'machineWastage'">
        <!-- only rendered at all when machine.has_wastage is on -->
        <app-ag-grid-table
          [columns]="wastageTypeColumns"
          [dataSource]="wastageTypeDataSource"
          [toolbarConfig]="wastageTypeToolbarConfig"
          [displayConfig]="wastageTypeDisplayConfig"
          same action/delete config as machineState tab
          (newButtonClick)="isWastageTypeAssociate()"
          (deleteClick)="RemoveMachineWastageType($event)">

  <ui5-bar>
    ui5-button "Submit" (click)="AddMachine()" [disabled]="loading"
    ui5-button "Cancel" (click)="CloseDialog()" [disabled]="loading"

<!-- outside ui5-card: -->
<app-machine-group-form #machineGroupForm [saveMode]="saveMode" [machineGroup]="machineGroup" (groupAdded)="autoGroupAdded($event)">
<app-assosiate #stateAssociate [apiUrl]="'MachineStates?...'" [model]="stateList" (selectedData)="GetSelectedState($event)">
<app-assosiate #hallAssociate  [apiUrl]="'Halls?...'" [model]="hallList" [isMultiselect]="false" (selectedData)="GetSelectedHall($event)">
<app-assosiate #wastageTypeAssociate [apiUrl]="'MachineWastageTypes?...'" [model]="wastageTypeList" (selectedData)="GetSelectedWastageType($event)">
```

---

## API Calls

| HTTP Method | Endpoint | When called | Payload | Response handling |
|---|---|---|---|---|
| GET | `/odata/MachineGroups?$orderby=id desc&$filter=is_active eq true` | `ngOnInit` → `LoadMachineGroup()` | None | `response.value` → `MachineGroup` |
| POST | `/odata/Machines` | `AddMachine()`, `saveMode === "POST"` | `machine.toOdata()` | `machine.deserialize(res)` to capture server-assigned `id` |
| PUT | `/odata/Machines(${machine.id})` | `AddMachine()`, `saveMode === "PUT"` | `machine.toOdata()` | Same |
| POST | `/api/machine/associate` | `Associate(id)` after successful machine save | `{ machine_id, machinestate, machinehall, machinegroup[], default_state_id, machinewastagetype }` | Success: emit `RefreshTable` + `isSuccessChange` → `CloseDialog()`. Error: error toast → `CloseDialog()`. |
| GET | `/api/machine/{id}/states` | `setMachineState()`, edit mode only | None | `{ states: {id, is_default}[] }` → `defaultStateId` set to whichever row has `is_default: true`. Exists solely because pivot data isn't exposed via the OData `Machines?$expand=states` path. |

No dedicated GET endpoint exists (or is needed) for wastage types — `machine_has_wastage` has no `is_default`-equivalent pivot column, so `Machines?$expand=machinewastagetypes` (already in the list component's `dataSource.expand`) fully covers loading the current associations on edit.

---

## Validation Logic

| Field | Element | Trigger | Rule | Failure state |
|---|---|---|---|---|
| Machine Name | `ui5-input` | `(input)` + `validateForm()` | `machine.machine_name?.trim()` truthy | `valueStateOptions.name = ValueState.Negative` |
| Select Group | `ui5-combobox` | `(input)` + `validateForm()` | `machineTitleGroup.trim()` truthy | `valueStateOptions.group = ValueState.Negative` |
| OEE | `ui5-input type="Number"` | `(input)` + `validateForm()` | `machine.oee` truthy | `valueStateOptions.oee = ValueState.Negative` |

On validation failure in `AddMachine()`: `selectedTab` forced to `"coreData"` so errors are visible.

---

## Services Injected

| Service | Methods used |
|---|---|
| `CommonService` | `get()` — machine groups; `post()` — create machine + associate; `put()` — update machine |
| `ToastService` | `show("add" \| "edit" \| "error")` |

---

## Inter-component Communication

### Parent → This component
- `machineFormRef.resetForm()` — clears form before open.
- `machineFormRef.machine = new Machine().deserialize(data)` — populates machine fields.
- `machineFormRef.saveMode = saveMode.POST / PUT`.
- `machineFormRef.SelectedGroup = ...` — restores selected group for edit.
- `machineFormRef.machineTitleGroup = ...` — restores group display name.
- `machineFormRef.setMachineHall(data.machinehalls)` — loads halls into sub-grid.
- `machineFormRef.setMachineState(data.states)` — loads states into sub-grid.
- `machineFormRef.setMachineWastageType(data.machinewastagetypes)` — loads wastage types into sub-grid.
- `machineFormRef.LoadMachineGroup()` — (re)loads group combobox.
- `machineFormRef.open = true` — opens the form.

### This component → Parent
- `RefreshTable` — signals list reload. Emitted before `CloseDialog()`.
- `closeFrom` — signals panel close. Emitted by `CloseDialog()` after `resetForm()`.
- `isSuccessChange` — confirms successful save.

### This component → Child: `MachineGroupFormComponent` (`#machineGroupForm`)
- `machineGroupFormRef.open = true` to open inline group creation.
- `(groupAdded)` → `autoGroupAdded($event)`.

### This component → Child: `AssosiateComponent` (`#stateAssociate`, `#hallAssociate`, `#wastageTypeAssociate`)
- `open = true` + `bindingData` set imperatively to open and pre-populate.
- `(selectedData)` → `GetSelectedState()` / `GetSelectedHall()` / `GetSelectedWastageType()`.

---

## Enums / Models Used

| Type | Source | Usage |
|---|---|---|
| `Machine` | `@shared/model/machine` | Primary form model; `machine.toOdata()` as save payload |
| `MachineGroup` | `@shared/model/machineGroup` | Group combobox selection and association payload |
| `MachineState` | `@shared/model/machineState` | State association sub-grid |
| `Hall` | `@shared/model/hall` | Hall association sub-grid |
| `MachineWastageType` | `@shared/model/machineWastageType` | Wastage-type association sub-grid |
| `saveMode` | `@shared/enums/saveMode` | `POST` / `PUT` branch logic |
| `ValueState` | `@ui5/webcomponents-base/dist/types/ValueState.js` | Form field error states |
| `Localization` | `@shared/utilities/localization` | i18n strings |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column in sub-grids |
| `AgGridRadioCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/ag-grid-cell-renderers.component` | Default column in the state sub-grid — one `ui5-radio-button` per row, `onSelect` callback via `cellRendererParams` |
| `AgGridTableColumn`, `AgGridTableDisplayConfig`, `AgGridTableODataSourceConfig`, `AgGridTableToolbarConfig` | `@shared/components/ag-grid-table/types/ag-grid-table.types` | Sub-grid config types |
| `AssosiateComponent` | `@shared/components/assosiate/assosiate.component` | ViewChild type for state/hall associate dialogs |
| `MachineGroupFormComponent` | `@base-data-module/machine-management/machine-group/machine-group-form/machine-group-form.component` | ViewChild type for inline group creation |

---

## Key Business Logic

### Two-step Save Pattern
Machine record saved first (POST/PUT to OData). If any association exists (`MachineState.length > 0` OR `SelectedGroup.id` truthy OR `MachineHall.length > 0` OR `MachineWastageType.length > 0`), `Associate()` fires next. Otherwise only the machine is saved.

### Machine Wastage Tab — Conditional on `has_wastage`
The "Machine Wastage" `<ui5-tab>` carries `*ngIf="machine.has_wastage"` — it doesn't just disable, it's absent from the DOM entirely until the Core Data tab's "Has Wastage" switch is on. Mirrors `MachineState`'s associate flow exactly (multi-select `app-assosiate`, same sub-grid/toolbar/display-config shape as `MachineHall`'s single-select one, but without the `[isMultiselect]="false"` override — multiple wastage types can be tagged per machine). Backend pivot: `machine_has_wastage` table (`machine_id`, `wastage_id` — non-standard FK column name, so `Machine::machinewastagetypes()` / `MachineWastageType::machines()` both specify the pivot table and both FK columns explicitly rather than relying on Eloquent's naming convention). No surrogate `id` column and no `is_default`-equivalent column — plain many-to-many with just the FK pair + unique constraint. Same shape `machine_has_states` started with, before it later needed a follow-up migration to add `id` + `is_default`.

### Refresh-Before-Close Ordering
`RefreshTable.emit()` and `isSuccessChange.emit()` fire **before** `CloseDialog()` in all code paths (both the non-associate path and the `associate()` callback). This is critical: `CloseDialog()` emits `closeFrom`, which triggers `cancelEdit()` in the parent, setting `isTabCollapsed = true` and collapsing the right panel. If `RefreshTable` fired after collapse, the grid reload would race with the layout change.

### Static Sub-grid Update via Spread-Reassign
The state and hall sub-grids use `staticData: true`. Data changes are pushed by spread-reassigning the entire `dataSource` object — the new object reference triggers `ngOnChanges` on the child `AgGridTableComponent`. The hall grid does this with a plain fresh array (`{ ...this.hallDataSource, data: [...this.MachineHall] }`) since none of its columns depend on external component state. The **state** grid's `updateStateGrid()` goes one step further and rebuilds fresh row *objects* too (see its own method doc above) — required specifically because the Default column's checked state depends on `defaultStateId`, a value that lives outside the row data.

### OData vs API URL Routing
`Machines` and `MachineGroups` use the OData prefix (third arg `true` or omitted). `machine/associate` uses the REST API prefix (third arg `false`).

### `machine.toOdata()` Strips Relations
`toOdata()` sets `machinegroups`, `machinehalls`, `states`, `machinewastagetypes`, `created_at`, `updated_at` to `undefined`. Relations are handled exclusively via the `machine/associate` endpoint.

### Machine ID Capture for New Records
On POST success, `machine.deserialize(res)` captures the server-assigned `id` before `Associate(machine.id)` is called, ensuring the association payload always carries the correct `machine_id`.

### `resetForm()` Called by `CloseDialog()`
`CloseDialog()` calls `resetForm()` internally. The parent also calls `machineFormRef.resetForm()` explicitly before opening the form, ensuring a clean state even before the dialog is shown.

### Hall Associate Dialog: Single-select Only
`#hallAssociate` has `[isMultiselect]="false"` — only one hall per machine at a time. State associate defaults to multi-select.
