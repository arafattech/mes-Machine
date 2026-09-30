# Base Data Management — Client Management

## Files
```
client-management/
├── client-form/
│   ├── client-form.component.ts
│   └── client-form.component.html
├── client-list/
│   ├── client-management.component.ts   ← ag-grid (converted from .tsx)
│   └── client-management.component.html
├── client-area/
│   ├── client-area-form/
│   │   ├── client-area-form.component.ts
│   │   └── client-area-form.component.html
│   └── area-list/
│       ├── area-list.component.ts   ← ag-grid (converted from .tsx)
│       └── area-list.component.html
└── client-notes/
    ├── client-note-form/
    │   ├── client-note-form.component.ts
    │   └── client-note-form.component.html
    └── notes-list/
        ├── notes-list.component.ts   ← ag-grid (converted from .tsx)
        └── notes-list.component.html
```

## Routes
- `/base-data/client` — `ClientManagementComponent` — guarded by `BASE_DATA_CLIENT`
- `/base-data/client-area` — `AreaListComponent` — guarded by `BASE_DATA_CLIENT_AREAS`
- `/base-data/client-note` — `NotesListComponent` — guarded by `BASE_DATA_CLIENT_NOTE`

## Purpose
Manages **Clients** (customers) with full contact information, billing/shipping addresses, and classification via **Client Areas** (geographic/business regions) and **Client Notes** (terms, payment notes, etc.).

---

## ClientFormComponent

### Selector
`app-client-form`

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` or `'PUT'` |
| `client` | `Client` | Pre-populated client model for edit mode |

### Outputs

| Output | Type | Purpose |
|--------|------|---------|
| `ClientAdded` | `EventEmitter<Client>` | Emits the saved client object |
| `RefreshTable` | `EventEmitter<any>` | Triggers list reload |

### Key Properties

| Property | Purpose |
|----------|---------|
| `selectedTab` | Active tab: `'coreData'` or `'personalData'` |
| `showAddMore` | Toggles second contact person section |
| `sameAsBillTo` | When `true`, ship_to auto-syncs with bill_to input |
| `SelectedNote` | Associated `ClientNote` object |
| `SelectedArea` | Associated `ClientArea` object |
| Validation state maps | Per-field `ValueState` objects for: `name`, `email`, `address`, `bill_to`, `ship_to` |

### Key Methods

| Method | Description |
|--------|-------------|
| `saveClientInfo()` | Validates both tabs, then POSTs/PUTs client, then calls `ClientAssociate(id)` |
| `ClientAssociate(id)` | POSTs to `client/associate` to link the client with selected area and note |
| `LoadClientNote()` | Fetches `ClientNotes?$filter=is_active eq true` for the note dropdown |
| `LoadClientArea()` | Fetches `ClientAreas?$filter=is_active eq true` for the area dropdown |
| `getNote()` | Sets `SelectedNote` from dropdown selection event |
| `getArea()` | Sets `SelectedArea` from dropdown selection event |
| `coreDataValid()` | Validates `name` and `email` fields |
| `addressvalidation()` | Validates `address`, `bill_to`, `ship_to` fields |
| `addMore()` | Toggles `showAddMore` to reveal/hide second contact block |
| `onBillToInput()` | Copies `bill_to` value into `ship_to` when `sameAsBillTo` is `true` |
| `onTabSelect(event)` | Updates `selectedTab` on tab click |

### API Calls

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `ClientNotes?$orderby=id desc&$filter=is_active eq true` | Populate note dropdown |
| GET | `ClientAreas?$orderby=id desc&$filter=is_active eq true` | Populate area dropdown |
| POST | `Clients` | Create new client |
| PUT | `Clients(${client.id})` | Update existing client |
| POST | `client/associate` | Associate client with area and note (custom endpoint) |

### Template Structure
```
<app-client-form>
  └── TabContainer
      ├── Tab: Core Data
      │   ├── name (required)
      │   ├── email (required)
      │   ├── phone
      │   ├── ClientArea dropdown (loaded from API)
      │   └── ClientNote dropdown (loaded from API)
      └── Tab: Personal Data
          ├── address (required)
          ├── bill_to (required)
          ├── ship_to (required, or synced from bill_to)
          ├── "Same as Bill To" checkbox → onBillToInput()
          ├── Contact person 1 (always visible)
          └── Contact person 2 (toggled by showAddMore)
```

### Client Model (inferred)
```typescript
interface Client {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  bill_to?: string;
  ship_to?: string;
  contact_person_1?: string;
  contact_person_2?: string;
  client_note_id?: number;
  client_area_id?: number;
  is_active: boolean;
}
```

---

## ClientAreaFormComponent

### Selector
`app-client-area-form`

### Purpose
Simple CRUD form for geographic/business client areas (regions, territories).

### API Calls
| Method | Endpoint |
|--------|----------|
| POST | `ClientAreas` |
| PUT | `ClientAreas(${id})` |

### ClientArea Model
```typescript
interface ClientArea {
  id?: number;
  name: string;
  is_active: boolean;
}
```

---

## ClientNoteFormComponent

### Selector
`app-client-note-form`

### Purpose
Simple CRUD form for client notes (payment terms, special instructions, etc.).

### API Calls
| Method | Endpoint |
|--------|----------|
| POST | `ClientNotes` |
| PUT | `ClientNotes(${id})` |

### ClientNote Model
```typescript
interface ClientNote {
  id?: number;
  name: string;
  description?: string;
  is_active: boolean;
}
```

---

## Services Injected

| Service | Usage |
|---------|-------|
| `CommonService` | All API calls |
| `ToastService` | Notifications |
| `RolePermissionService` | Action visibility |

## Validation Rules

| Field | Rule |
|-------|------|
| `name` | Required |
| `email` | Required |
| `address` | Required |
| `bill_to` | Required |
| `ship_to` | Required (unless auto-synced) |

## Notes
- The `client/associate` endpoint is a **custom Laravel API** (not standard OData) — it handles the N:1 relationship between client ↔ area and client ↔ note in a single call.
- `ClientArea` and `ClientNote` are lookup tables — they must be created first before creating clients that reference them.
- `sameAsBillTo` is a UX convenience — ship_to is still stored separately on the server; it's just pre-filled in the form.
