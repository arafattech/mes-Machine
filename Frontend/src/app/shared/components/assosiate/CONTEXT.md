# assosiate Component Context

Generic modal picker (`app-assosiate`) for selecting one or more OData-backed entities into a parent's working list — used by requisition item pickers, item-inventory associations, etc.

Location: `@shared/components/assosiate/assosiate.component.ts`

---

## Inputs

| Input | Type | Default | Purpose |
|-------|------|---------|---------|
| `isOpen` | `EventEmitter<void>` | — | Emit to open the dialog (also resets pagination + search) |
| `apiUrl` | `string` | `''` | OData endpoint (e.g. `'Products?'`) |
| `orderByColumn` | `string` | `'created_at'` | `$orderby` column, always `desc` |
| `getAssociateData` | `EventEmitter<any>` | — | Push in the parent's current selection (seeds `bindingData` so previously-picked rows show checked) |
| `isMultiselect` | `boolean` | `true` | `Multiple` vs `SingleStart` list selection mode |
| `isAddMore` | `boolean` | `false` | Shows inline "+" add button (`ProductTypes?` / `ItemCategories?` only) |
| `model` | `any` | — | Deserializable model class, applied to every row via `new this.model().deserialize(item)` |
| `tableColumn` | `any` | — | `{ accessor: string }[]` — drives both displayed columns and search-filter fields |
| `filterQuery` | `any` | — | Static OData `$filter` fragment, ANDed with search |

## Outputs

| Output | Emits | When |
|--------|-------|------|
| `selectedData` | `bindingData` (full array) | `Assign()` — Submit button |
| `close` | `void` | declared but not currently emitted by the component itself |
| `IsInsert` / `IsInsertCategory` | `void` | inline "+" add clicked for `ProductTypes?` / `ItemCategories?` |

---

## Selection model — merge, never overwrite

The list (`ui5-list`, `*ngFor="let item of GetAssociateData"`) only ever renders the **currently visible** page/search results — not the full previously-selected set. `SelectionChange` / `SelectAll` / `DselectAll` must never blind-assign `bindingData` from what's visible, or picks made before a search/scroll silently vanish on submit.

Fixed pattern (all three methods): partition `bindingData` into "outside current visible set" (kept untouched, by `id`) vs "inside current visible set" (replaced by the new checkbox state), then concatenate:

```ts
const visibleIds = new Set(this.GetAssociateData.map((item: any) => item.id));
const keptFromOutsideVisible = this.bindingData.filter((item: any) => !visibleIds.has(item.id));
this.bindingData = [...keptFromOutsideVisible, ...currentlyVisibleSelection];
```

- `SelectionChange($event)` — `currentlyVisibleSelection` = `$event.detail.selectedItems.map(i => i.value)`.
- `SelectAll()` — `currentlyVisibleSelection` = `this.GetAssociateData` (all visible rows).
- `DselectAll()` — no visible rows selected; just drops the visible-id items from `bindingData`.

**Regression this guards against**: search → check an item → submit used to lose every item checked before the search (and select-all/deselect-all wiped the entire cross-page selection, not just the visible page).

---

## Search/dialog reset on open and close

The search `<ui5-input>` is DOM-event bound (`(input)="handleSearch($event)"`), not `[(ngModel)]` — its displayed value is **not** driven by a component field, so it must be cleared imperatively via `#searchInput` `ViewChild<ElementRef>`.

`resetSearch()` (clears `searchFilter`, kills pending debounce, blanks the input's `nativeElement.value`) runs on:
- **open** (`isOpen.subscribe`, alongside `offset = 0` / `GetAssociateData = []`)
- **close** (`closeDialog()`, hit by both `Assign()`/Submit and Cancel)

**Regression this guards against**: reopening the dialog after a submit/cancel used to still show the previous search term and its filtered results instead of a fresh unfiltered list.

---

## Key methods

| Method | Purpose |
|--------|---------|
| `getInitialData()` | Fetches next page (`$skip`/`$top`), **appends** to `GetAssociateData` |
| `handleSearch(event)` | 400ms debounce → `filterData()` |
| `filterData(filter)` | Builds `contains(accessor, 'val')` per `tableColumn` entry, ANDs with `filterQuery`, **replaces** `GetAssociateData` with page 1 of results |
| `onScroll(event)` | `load-more` on the list — re-runs `filterData` (if searching) or `getInitialData` (if not) |
| `isSelected(item)` | Checkbox state — `bindingData.some(d => d.id === item.id)` |
| `SelectionChange` / `SelectAll` / `DselectAll` | See merge pattern above |
| `Assign()` | Emits `selectedData` = `bindingData`, then `closeDialog()` |
| `closeDialog()` | Resets `open`, `Selectall`, `bindingData`, and search state |

## Known gap

`onScroll` while a search is active calls `filterData(this.searchFilter)` again, which **replaces** (not appends) `GetAssociateData` — infinite-scroll pagination during an active search re-fetches page 1 repeatedly instead of advancing pages. Not yet fixed; only the selection-loss and stale-search-on-reopen bugs above have been addressed.

---

## CONTEXT.md maintenance

Update this file whenever:
- `SelectionChange` / `SelectAll` / `DselectAll` merge logic changes
- open/close reset behavior changes
- new inputs/outputs added to `assosiate.component.ts`
