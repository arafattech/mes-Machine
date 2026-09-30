# Custom Grid Table Context Index

The detailed context for `custom-grid-table` is split into feature-focused files under `Frontend/docs/shared-components/custom-grid-table-contexs/`.

## Scope

- Legacy React-based reusable table wrapper.
- Covers OData mode, custom API mode, inline editors, toolbar actions, state cache, and selection/settings behavior.
- Source references:
  - `Frontend/src/app/shared/components/custom-grid-table/custom-grid-table.component.tsx`
  - `Frontend/src/app/shared/components/custom-grid-table/custom-grid-table.component.html`
  - `Frontend/src/app/shared/components/custom-grid-table/CONTEXT.md`
  - `Frontend/src/app/shared/components/custom-grid-table/AG-GRID-MIGRATION.md`

## Split Docs

- `Frontend/docs/shared-components/custom-grid-table-contexs/INDEX.MD`
- `Frontend/docs/shared-components/custom-grid-table-contexs/ODATA_CONTEXT.MD`
- `Frontend/docs/shared-components/custom-grid-table-contexs/CUSTOM_API_CONTEXT.MD`
- `Frontend/docs/shared-components/custom-grid-table-contexs/INLINE_EDIT_CONTEXT.MD`
- `Frontend/docs/shared-components/custom-grid-table-contexs/STATE_AND_SETTINGS_CONTEXT.MD`
- `Frontend/docs/shared-components/custom-grid-table-contexs/TOOLBAR_AND_SELECTION_CONTEXT.MD`
- `Frontend/docs/shared-components/custom-grid-table-contexs/ROW_ACTIONS_AND_EVENTS_CONTEXT.MD`

## Recommended Reading Order

- Start with `INDEX.MD` for the feature map.
- Use `ODATA_CONTEXT.MD` for service-backed filtering and pagination.
- Use `CUSTOM_API_CONTEXT.MD` when the parent component owns search/load-more behavior.
- Use `INLINE_EDIT_CONTEXT.MD` for editable cell rendering and row mutation hooks.
- Use `STATE_AND_SETTINGS_CONTEXT.MD` for localStorage cache and column management.
- Use `TOOLBAR_AND_SELECTION_CONTEXT.MD` for search, filters, buttons, and selection controls.
- Use `ROW_ACTIONS_AND_EVENTS_CONTEXT.MD` for edit/delete/info and toolbar events.
