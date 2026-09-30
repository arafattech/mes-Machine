# Base Data Management — Machine Management

## Files
```
machine-management/
├── machine-form/
│   ├── machine-form.component.tsx          ← React/TSX
│   └── machine-form.component.html
├── machine-management-list/
│   └── machine-management.component.tsx    ← React/TSX list
├── machine-config/
│   ├── machine-config.component.tsx        ← React/TSX
│   └── machine-config.component.html
├── machine-state/
│   └── machine-state-form/
│       ├── machine-state-form.component.ts
│       └── machine-state-form.component.html
├── machine-group/
│   └── machine-group-form/
│       ├── machine-group-form.component.ts
│       └── machine-group-form.component.html
├── machine-wastage-type/
│   ├── machine-wastage-type-list/
│   │   ├── machine-wastage-type-list.component.ts
│   │   └── machine-wastage-type-list.component.html
│   └── machine-wastage-type-form/
│       ├── machine-wastage-type-form.component.ts
│       └── machine-wastage-type-form.component.html
├── machine-production-target/
│   ├── machine-production-target-list/
│   │   ├── machine-production-target-list.component.ts
│   │   └── machine-production-target-list.component.html
│   └── machine-production-target-form/
│       ├── machine-production-target-form.component.ts
│       └── machine-production-target-form.component.html
└── shared/model/
    └── MachineConfig.ts
```
(`MachineProductionTarget` model lives at `Frontend/src/app/shared/model/machineProductionTarget.ts`, not under this feature folder — same shared-model location as `machineWastageType.ts`.)

## Routes
- `/base-data/machines` — `MachineManagementComponent` — `BASE_DATA_MACHINE`
- `/base-data/machine-config` — `MachineConfigComponent` — `BASE_DATA_MACHINE_CONFIG`
- `/base-data/machine-group` — `MachineGroupListComponent` — `BASE_DATA_MACHINE_GROUP`
- `/base-data/machine-state` — `MachineStateListComponent` — `BASE_DATA_MACHINE_STATE`
- `/base-data/machine-wastage-type` — `MachineWastageTypeListComponent` — `BASE_DATA_MACHINE_WASTAGE_TYPE`
- `/base-data/machine-production-target` — `MachineProductionTargetListComponent` — `BASE_DATA_MACHINE_PRODUCTION_TARGET`
- `/base-data/hall` — `HallListComponent` — `BASE_DATA_HALL`

---

## MachineFormComponent

### Selector
`app-machine-form`

### Type
React/TSX wrapped inside Angular shell.

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` or `'PUT'` |
| `machine` | `Machine` | Pre-populated machine for edit |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `SelectedState` | `EventEmitter<any>` | Passes selected machine state upstream |
| `SelectedHall` | `EventEmitter<any>` | Passes selected hall upstream |
| `IsOpenMachineStateAssociate` | `EventEmitter<void>` | Opens state association dialog |
| `IsOpenMachineHallAssociate` | `EventEmitter<void>` | Opens hall association dialog |
| `RefreshTable` | `EventEmitter<any>` | Triggers list reload |
| `closeFrom` | `EventEmitter<any>` | Closes the form dialog |
| `isSuccessChange` | `EventEmitter<any>` | Fires on successful save |

### ViewChild References
- `machineHallTableRef: AnalyticalTableComponent` — Hall association table
- `machineStateTableRef: AnalyticalTableComponent` — State association table
- `hallAssociateRef: AssosiateComponent` — Hall picker dialog
- `stateAssociateRef: AssosiateComponent` — State picker dialog
- `machineGroupFormRef: MachineGroupFormComponent` — Inline group form

### Key Properties

| Property | Purpose |
|----------|---------|
| `selectedTab` | Active tab: `'coreData'` or `'associations'` |
| `MachineState` | `MachineState[]` — states linked to this machine |
| `MachineHall` | `Hall[]` — halls linked to this machine |
| `SelectedGroup` | `MachineGroup` — the selected machine group |
| `machineTitleGroup` | Display name for selected group |

### Key Methods

| Method | Description |
|--------|-------------|
| `AddMachine()` | Validates form, saves machine, then calls `Associate(id)` |
| `LoadMachineGroup()` | `GET MachineGroups?$filter=is_active eq true` |
| `getGroup(items)` | Sets `SelectedGroup` from dropdown |
| `Associate(id)` | POSTs to `machine/associate` with states, halls, group_id |
| `isHallAssociate()` | Emits `IsOpenMachineHallAssociate` |
| `isStateAssociate()` | Emits `IsOpenMachineStateAssociate` |
| `RemoveMachineState(item)` | Removes from `MachineState[]` array locally |
| `RemoveMachineHall(item)` | Removes from `MachineHall[]` array locally |
| `MachineStateColum()` | Returns React table column config for states grid |
| `MachineHallColum()` | Returns React table column config for halls grid |
| `validateForm()` | Checks required fields |
| `OnAddClickMachineGroup()` | Opens inline group creation form |
| `autoGroupAdded(newGroup)` | Auto-selects a newly created group |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `MachineGroups?$orderby=id desc&$filter=is_active eq true` | Group dropdown |
| POST | `Machines` | Create machine |
| PUT | `Machines(${id})` | Update machine |
| POST | `machine/associate` | Link states, halls, group to machine |

### Template Structure
```
<app-machine-form>
  └── TabContainer
      ├── Tab: Core Data
      │   ├── name (required)
      │   ├── machine_no
      │   ├── MachineGroup dropdown (with inline "Add New" option)
      │   └── description
      └── Tab: Associations
          ├── "Add State" button → isStateAssociate()
          ├── MachineState table (with delete per row)
          ├── "Add Hall" button → isHallAssociate()
          └── MachineHall table (with delete per row)
```

---

## MachineConfigComponent

### Selector
`app-machine-config`

### Type
React/TSX — dedicated PLC/IoT configuration form.

### Purpose
Configures how a machine communicates with the MES backend — PLC IP address, protocol, data read method, signal mappings, API endpoints, and I/O pin configuration.

### Key Properties

| Property | Type | Purpose |
|----------|------|---------|
| `machineConfig` | `MachineConfig` | Config model being created/edited |
| `Machines` | `Machine[]` | Available machines for the machine selector |
| `protocolOptions` | `string[]` | `['HTTP', 'HTTPS']` |
| `typeOptions` | `string[]` | `['Cast/cast_sig', 'Cast', 'Signal']` |
| `readFromOptions` | `string[]` | `['CHANNEL', 'PLC', 'API', 'MODBUS']` |
| `hasExistingMachineConfig` | `boolean` | Prevents duplicate configs per machine |
| `saveMode` | `string` | `'POST'` or `'PUT'` |

### Key Methods

| Method | Description |
|--------|-------------|
| `GetMachines()` | `GET Machines` — populates machine selector |
| `newConfig()` | Initializes POST mode with blank `MachineConfig` |
| `editConfig(event)` | Loads selected config into form (PUT mode) |
| `SaveConfig()` | Validates and saves config |
| `DeleteConfig(event)` | Emits delete event to parent |
| `validateForm()` | Requires `machine_id` and `ip_plc` |
| `onMachineSelection(event)` | Checks `MachineHasConfigs?$filter=machine_id eq ${id}` for existing config |
| `onSelectChange(field, event)` | Updates select/dropdown fields |
| `onSwitchChange(field, event)` | Updates boolean toggle fields |
| `checkValidation(event, field)` | Real-time field validation |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `Machines` | Machine selector |
| GET | `MachineHasConfigs?$filter=machine_id eq ${id}` | Duplicate config check |
| POST | `machine/configs` | Create config |
| PUT | `machine/configs/${id}` | Update config |
| DELETE | `MachineConfigs/${id}` | Delete config |

---

## MachineConfig Model
`shared/model/MachineConfig.ts`

```typescript
class MachineConfig {
  id?: number;
  machine_id?: number;           // default: 0
  machine_name: string;          // default: ''
  is_active: boolean;            // default: true
  config_id?: number;            // default: 0
  ip_plc: string;                // default: '' — required
  protocol: string;              // default: 'HTTP'
  type: string;                  // default: 'Cast/cast_sig'
  read_from: string;             // default: 'CHANNEL'
  shot_buffer?: number;          // default: 0
  timeout_sec?: number;          // default: 0
  server_call_sec?: number;      // default: 0
  ideal_cycle_seconds?: number;  // no default — feeds node-server's OEE Performance calc (machine-calculations.service.ts), reads null/0 until set here
  auto_signal?: string;          // default: ''
  shot_signal?: string;          // default: ''
  inverse_auto: boolean;         // default: false
  inverse_shot: boolean;         // default: false
  auto_independent: boolean;     // default: false
  live_status_api?: string;
  live_shot_api?: string;
  test_status_api?: string;
  test_shot_api?: string;
  active: boolean;               // default: false
  scrap: boolean;                // default: false
  robot_active: boolean;         // default: false
  robot?: string;
  press_active: boolean;         // default: false
  press?: string;
  handling_active: boolean;      // default: false
  handling?: string;
  selection_type?: string;
  created_at?: string;
  updated_at?: string;

  deserialize(input: any): this   // maps input object to properties
  toOdata(): object               // serializes for API (excludes created_at, updated_at)
}
```

---

## MachineStateFormComponent

### Selector
`app-machine-state-form`

### Purpose
Simple CRUD form for machine states (e.g., Running, Idle, Maintenance, Fault).

### API Calls
| Method | Endpoint |
|--------|----------|
| POST | `MachineStates` |
| PUT | `MachineStates(${id})` |

---

## MachineGroupFormComponent

### Selector
`app-machine-group-form`

### Outputs
- `groupAdded: EventEmitter<MachineGroup>` — emits new group so `MachineFormComponent` can auto-select it.

### API Calls
| Method | Endpoint |
|--------|----------|
| POST | `MachineGroups` |
| PUT | `MachineGroups(${id})` |

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All API calls |
| `ToastService` | Notifications |
| `RolePermissionService` | Permissions |
| `ChangeDetectorRef` | Manual change detection (React/TSX interop) |

## Validation Rules

| Component | Required Fields |
|-----------|----------------|
| MachineForm | `name` |
| MachineConfig | `machine_id`, `ip_plc` |
| MachineStateForm | `name` |
| MachineGroupForm | `name` |

## Key Relationships
- Machine → belongs to MachineGroup (optional)
- Machine → has many MachineStates (via associate)
- Machine → has many Halls (via associate)
- Machine → has one MachineConfig (1:1, enforced by duplicate check)
- Machine → used in OperationPositions and ProductionOrders

## Notes
- `machine/associate` is a **custom non-OData endpoint** that handles the many-to-many relationship between machines, states, and halls in a single POST.
- The duplicate config check (`MachineHasConfigs`) prevents a machine from having more than one PLC config.
- `MachineGroupFormComponent` can be opened inline within `MachineFormComponent` — when saved, it emits `groupAdded` and the parent auto-selects the new group.
