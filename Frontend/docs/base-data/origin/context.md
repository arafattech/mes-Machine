# Origin

## Purpose

Origin maintains the master list of sources/origins. It follows the existing UOM CRUD pattern.

## Database

`origins` is created by `2026_08_24_110000_create_origins_table.php`.

| Field | Type | Notes |
| --- | --- | --- |
| `is_active` | boolean | Defaults to `true` |
| `custom_id` | string | Generated with the `ORG-` prefix |
| `name` | string | Required in the form |
| `remarks` | text | Optional; displayed only in the create/edit dialog |

The product migration `2026_08_04_100000_add_is_raw_cotton_to_products_table.php` adds `products.is_raw_cotton`, defaulting to `false`.

## Frontend

- List: `product-management/origin/origin-list`
- Form: `product-management/origin/origin-form`
- Route: `/base-data-management/origin-list`
- OData entity set: `Origins`

The list intentionally omits the `remarks` column, as requested. Remarks remain editable in the dialog.

## Permissions

- `BASE_DATA_ORIGIN_LIST`
- `BASE_DATA_ORIGIN_CREATE`
- `BASE_DATA_ORIGIN_EDIT`
- `BASE_DATA_ORIGIN_DELETE`

## Product form

The Item Form Core Data tab has a **Raw Cotton** switch next to **Sellable Item**. Its value is persisted through the `is_raw_cotton` product field.
