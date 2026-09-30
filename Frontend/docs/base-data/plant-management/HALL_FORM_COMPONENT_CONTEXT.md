# HALL_FORM_COMPONENT — Component Context

## Overview

| Property      | Value                                                                                                     |
|---------------|-----------------------------------------------------------------------------------------------------------|
| TS file       | `src/app/modules/base-data-management/hall-management/hall-form/hall-form.component.ts`                  |
| HTML file     | `src/app/modules/base-data-management/hall-management/hall-form/hall-form.component.html`                |
| Selector      | `app-hall-form`                                                                                           |
| Component type | Form / Dialog                                                                                            |
| Purpose       | Modal dialog form to create or edit a **Hall** record. Two tabs — Core Data (hall name + active flag) and Plant (associate one plant via `app-ag-grid-table` with static data). On submit, calls POST or PUT to persist the hall, then calls `associate()` to post the plant association. |

---

## Inputs (@Input)

| Input name | Type   | Default          | Purpose                                                                                         |
|------------|--------|------------------|-------------------------------------------------------------------------------------------------|
| `saveMode` | `string` | `"POST"`       | Create (`"POST"`) or update (`"PUT"`) mode. Compared against `saveMode` enum values at runtime. |
| `hall`     | `Hall` | `new Hall().deserialize({})` | The hall record to display/edit. Set by the parent via `@ViewChild` before `open = true`. |

> Both properties are technically `@Input()` but are set **imperatively** by the parent via ViewChild, not via template bindings.

---

## Outputs (@Output)

| Output name  | Type              | Purpose                                                                                                      |
|--------------|-------------------|--------------------------------------------------------------------------------------------------------------|
| `RefreshTable` | `EventEmitter<void>` | Emitted inside `associate()` on success, signalling the parent list to reload. Always emitted **before** `CloseDialog()` is called. |

---

## State Properties

| Property             | Type                            | Default                            | Purpose                                                                                             |
|----------------------|---------------------------------|------------------------------------|-----------------------------------------------------------------------------------------------------|
| `selectedTab`        | `string`                        | `"coreData"`                       | Tracks the active tab. Reset to `"coreData"` on close/reset.                                       |
| `open`               | `boolean`                       | `false`                            | Controls visibility of the `ui5-dialog`. Set to `true` by the parent to open.                      |
| `loading`            | `boolean`                       | `false`                            | Activates `ui5-busy-indicator` and disables footer buttons during HTTP requests.                    |
| `ToastType`          | `"add" \| "edit" \| "error"`    | `"add"`                            | Toast variant shown after save.                                                                     |
| `validationMessage`  | `string`                        | `Localization.requiredField`       | Shown in `valueStateMessage` slot on the Hall Name input.                                           |
| `valueState`         | `typeof ValueState`             | `ValueState`                       | Exposes the ValueState enum to the template.                                                        |
| `localization`       | `typeof Localization`           | `Localization`                     | i18n string map exposed to the template.                                                            |
| `permissions`        | `typeof Permissions`            | `Permissions`                      | Permissions enum exposed to the template for RBAC checks.                                          |
| `plantList`          | `typeof Plant`                  | `Plant` (class reference)          | Passed as `[model]` to `app-assosiate`. Provides the model class for column inference.              |
| `plants`             | `Plant[]`                       | `[]`                               | In-memory list of plants currently associated with the hall. Mutated by `GetSelectedHall()`, `removePlantData()`, and `setPlants()`. |
| `valueStateOptions`  | `{ name: ValueState }`          | `{ name: ValueState.None }`        | Validation state for the Hall Name field.                                                           |
| `plantDataSource`    | `AgGridTableODataSourceConfig<Plant>` | `{ type:"odata", endpoint:"", staticData:true, data:[] }` | Static data source for the Plant sub-grid. Spread-reassigned to push updates. |
| `plantToolbarConfig` | `AgGridTableToolbarConfig`      | headerTitle "Plant List", showNewButton, addButtonText "Associate", search/rowcount/segment off | Toolbar for the plant sub-grid. |
| `plantDisplayConfig` | `AgGridTableDisplayConfig`      | `{ gridHeight:"calc(100vh - 460px)", fillEmptyRows:true }` | Fixed height for the plant sub-grid inside the tab. |
| `plantColumns`       | `AgGridTableColumn<Plant>[]`    | Active (boolean renderer), ID, Name, Created On | Column definitions for the plant sub-grid. |

---

## ViewChild / ViewChildren

| Ref name           | Template ref  | Type                 | Usage                                                                                                        |
|--------------------|---------------|----------------------|--------------------------------------------------------------------------------------------------------------|
| `hallAssociateRef` | `#plantAssociate` | `AssosiateComponent` | Opened in `isHallAssociate()` to select a plant. `bindingData` pre-set with current `plants`. Cleared in `resetForm()`. |

---

## Lifecycle Hooks

| Hook       | What happens                                                                                  |
|------------|-----------------------------------------------------------------------------------------------|
| `ngOnInit` | Empty — no initialization logic. Component relies on parent opening it with `open = true`.    |

---

## Methods — DETAILED

### `checkValidation(event: any)`
Reads `event.target.value`. If trimmed is empty → `valueStateOptions.name = ValueState.Negative`. Else → `ValueState.None`.

---

### `validateForm(): boolean`
Checks `this.hall.name` — falsy → `valueStateOptions.name = ValueState.Negative`, returns `false`. Else returns `true`.

---

### `associatePlantTableColum(): { accessor: string }[]`
Returns `[{ accessor: "custom_id" }, { accessor: "name" }]`. Used as `[tableColumn]` on `app-assosiate`.

---

### `setPlants(plants: Plant[]): void`
Public setter called by the parent to load plants for edit mode. Assigns `plants ?? []` to `this.plants`, then calls `updatePlantGrid()`.

---

### `updatePlantGrid(): void` (private)
Spread-reassigns `plantDataSource` with the current `plants` array:
```typescript
this.plantDataSource = { ...this.plantDataSource, data: [...this.plants] };
```
Produces a new object reference, triggering `ngOnChanges` on the child `app-ag-grid-table`.

---

### `isHallAssociate(): void`
Sets `hallAssociateRef.open = true` and `hallAssociateRef.bindingData = this.plants`.

---

### `GetSelectedHall(items: Plant[]): void`
Called by `(selectedData)` on `#plantAssociate`. Assigns `items` to `this.plants` and calls `updatePlantGrid()`.

---

### `removePlantData(item: Plant): void`
Filters `this.plants` excluding `item.id` (strict `!==`), reassigns to `this.plants`, and calls `updatePlantGrid()`.

---

### `newHall(): void`
Main save handler.

1. `validateForm()` — if invalid, sets `selectedTab = "coreData"` and returns.
2. `loading = true`.
3. POST `Halls` (new) or PUT `Halls(${hall.id})` (edit) using `hall.toOdata()`.
4. On success:
   - Extracts `id`: `res?.id` for POST, `hall.id` for PUT.
   - Shows toast.
   - Calls `associate(id)`.
5. On error: `CloseDialog()`, shows error toast.

> `CloseDialog()` is NOT called before `associate()`. The dialog stays open until `associate()` completes, at which point `associate()` emits `RefreshTable` and calls `CloseDialog()`.

---

### `associate(id: number | undefined): void`
Posts plant association.

Payload: `{ hall_id: id, plants: this.plants }`.
`commonService.post("hall/associate", data, false)` — REST API prefix.

- On success: **`RefreshTable.emit()` → `CloseDialog()`**.
- On error: shows error toast → `CloseDialog()`.

---

### `onTabSelect(event: any): void`
Assigns `event.detail.tab.id` to `selectedTab`.

---

### `resetForm(): void`
1. `selectedTab = "coreData"`.
2. `hall = new Hall().deserialize({})`.
3. `valueStateOptions.name = ValueState.None`.
4. `hallAssociateRef.bindingData = []`.
5. `plants = []`.
6. `updatePlantGrid()`.

---

### `CloseDialog(): void`
1. `open = false`.
2. `loading = false`.
3. `resetForm()`.

Triggered by: `(before-close)` on `ui5-dialog`, Cancel button click, and end of `associate()`.

---

## Template Bindings & Structure

```
ui5-dialog [open]="open" (before-close)="CloseDialog()"
  ui5-busy-indicator [active]="loading"
    ui5-tabcontainer (tab-select)="onTabSelect($event)"

      ui5-tab id="coreData" [selected]="selectedTab === 'coreData'"
        ui5-switch [(ngModel)]="hall.is_active"
        ui5-input [(ngModel)]="hall.name"
                  [attr.value-state]="valueStateOptions.name"
                  (input)="checkValidation($event)"

      ui5-tab id="plant" [selected]="selectedTab === 'plant'"
        <app-ag-grid-table
          [columns]="plantColumns"
          [dataSource]="plantDataSource"
          [toolbarConfig]="plantToolbarConfig"
          [displayConfig]="plantDisplayConfig"
          [showAction]="true" [editPermission]="true"
          [showEditButton]="false"
          [showDeleteButton]="rolePermissionService.hasPermission(BASE_DATA_HALL_DELETE)"
          [showIllustratedMessage]="true" IllustratedName="NoData"
          (newButtonClick)="isHallAssociate()"
          (deleteClick)="removePlantData($event)">

  ui5-toolbar slot="footer"
    ui5-toolbar-button "Submit" (click)="newHall()" [disabled]="loading"
    ui5-toolbar-button "Cancel" (click)="CloseDialog()" [disabled]="loading"

<!-- outside dialog -->
<app-assosiate #plantAssociate
  [apiUrl]="'Plants?$orderby=id desc&$filter=is_active eq true'"
  [model]="plantList"
  [isMultiselect]="false"
  [tableColumn]="associatePlantTableColum()"
  (selectedData)="GetSelectedHall($event)">
```

---

## API Calls

| HTTP Method | Endpoint | `isOdata` | When called | Payload | Response handling |
|---|---|---|---|---|---|
| POST | `Halls` | `true` | `newHall()`, `saveMode === "POST"` | `hall.toOdata()` | Extract `res?.id`, call `associate(id)`, show "add" toast |
| PUT | `Halls(${hall.id})` | `true` | `newHall()`, `saveMode === "PUT"` | `hall.toOdata()` | Use `hall.id`, call `associate(id)`, show "edit" toast |
| POST | `hall/associate` | `false` | `associate(id)` after successful hall save | `{ hall_id: number, plants: Plant[] }` | Success: emit `RefreshTable` → `CloseDialog()`. Error: error toast → `CloseDialog()`. |

---

## Validation Logic

| Field      | Rule                                      | Failure state                           |
|------------|-------------------------------------------|-----------------------------------------|
| `hall.name` | Must be non-empty | `valueStateOptions.name = ValueState.Negative` — `Localization.requiredField` shown in slot |

Validation triggered: live on `(input)` via `checkValidation()`, and on submit via `validateForm()`. If submit fails, `selectedTab` forced to `"coreData"`.

---

## Services Injected

| Service | Visibility | Methods used |
|---|---|---|
| `CommonService` | `private` | `post()`, `put()` |
| `ToastService` | `private` | `show("add" \| "edit" \| "error")` |
| `RolePermissionService` | `public` | `hasPermission()` — plant grid delete button |

---

## Inter-component Communication

| Direction | Mechanism | Detail |
|---|---|---|
| Parent → Component | `@Input() saveMode`, `@Input() hall` (set imperatively via ViewChild) | Parent sets mode and hall data before `open = true`. |
| Parent → Component | `hallFormRef.resetForm()` | Parent resets form before open. |
| Parent → Component | `hallFormRef.setPlants(data.plants)` | Parent loads plant associations for edit. |
| Component → Parent | `@Output() RefreshTable` | Emitted inside `associate()` success, before `CloseDialog()`. |
| Component → Child (`AssosiateComponent`) | `hallAssociateRef.open`, `hallAssociateRef.bindingData` | Opened imperatively via ViewChild. |
| Child → Component | `(selectedData)` | Delivers selected plants to `GetSelectedHall()`. |

---

## Enums / Models Used

| Name | Source | Usage |
|---|---|---|
| `Hall` | `@shared/model/hall` | Primary data model; `hall.toOdata()` as save payload |
| `Plant` | `@shared/model/plant` | Associated entity; plant sub-grid model |
| `saveMode` | `@shared/enums/saveMode` | `POST` / `PUT` branch logic |
| `Permissions` | `@app/shared/enums/permissions` | `BASE_DATA_HALL_DELETE` — gates delete in plant grid |
| `ValueState` | `@ui5/webcomponents-base/dist/types/ValueState.js` | `None` / `Negative` for hall name validation |
| `Localization` | `@shared/utilities/localization` | `requiredField`, `Submit`, `Cancel`, `New`, `Edit`, etc. |
| `AgGridBooleanCellRendererComponent` | `@shared/components/ag-grid-table/cell-renderers/` | `is_active` column in plant sub-grid |
| `AgGridTableColumn`, `AgGridTableDisplayConfig`, `AgGridTableODataSourceConfig`, `AgGridTableToolbarConfig` | `@shared/components/ag-grid-table/types/ag-grid-table.types` | Plant sub-grid config types |
| `AssosiateComponent` | `@app/shared/components/assosiate/assosiate.component` | ViewChild type |

---

## Key Business Logic

### Two-step Save Pattern
Hall is saved first (POST/PUT to OData). On success, `associate()` is called with the hall `id`. For POST, `id` comes from `res?.id`; for PUT, from the existing `hall.id`. Plant associations are fully replaced on each save (not patched).

### Refresh-Before-Close Ordering
`RefreshTable.emit()` fires before `CloseDialog()` inside `associate()`. This prevents a race where the parent list would reload during or after form reset.

### Static Plant Grid via Spread-Reassign
The plant sub-grid uses `staticData: true`. All updates go through `updatePlantGrid()` which spread-reassigns `plantDataSource`, triggering `ngOnChanges` on `app-ag-grid-table`. No imperative `staticData.emit()` / `render()` calls.

### Single-plant Selection
`app-assosiate` has `[isMultiselect]="false"` — only one plant per hall.

### Permission-gated Delete
Delete button in the plant grid: `[showDeleteButton]="rolePermissionService.hasPermission(Permissions.BASE_DATA_HALL_DELETE)"`.

### OData vs API Routing
`Halls` and `Halls(id)` use OData prefix (`isOdata = true`). `hall/associate` uses REST API prefix (`isOdata = false`).
