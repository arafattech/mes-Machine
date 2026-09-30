# Base Data Management — Product Management

## Files
```
product-management/
├── product-list/
│   └── product-list.component.ts (or .tsx)
├── product-type/
│   └── product-type-list.component.ts (or .tsx)
├── item-category/
│   ├── category-form/
│   │   ├── category-form.component.ts
│   │   └── category-form.component.html
│   └── item-category-list/
├── item-sub-category/
│   ├── sub-category-form/
│   │   ├── sub-category-form.component.ts
│   │   └── sub-category-form.component.html
│   └── sub-category-list/
├── uom/
│   ├── uom-form/
│   │   ├── uom-form.component.ts
│   │   └── uom-form.component.html
│   └── uom-list/
│       ├── uom-list.component.ts   ← ag-grid (converted from .tsx)
│       └── uom-list.component.html
└── variant/
    ├── variant-form/
    │   ├── variant-form.component.ts
    │   └── variant-form.component.html
    └── item-variants/
```

## Routes
- `/base-data/products` — `ProductListComponent` — `BASE_DATA_ITEM`
- `/base-data/product-type` — `ProductTypeListComponent` — `BASE_DATA_ITEM_TYPE_LIST`
- `/base-data/item-categories` — `ItemCategoryListComponent` — `BASE_DATA_ITEM_CATEGORIES`
- `/base-data/item-subcategories` — `SubCategoryListComponent` — `BASE_DATA_ITEM_SUBCATEGORIES`
- `/base-data/item-variants` — `ItemVariantsComponent` — `BASE_DATA_ITEM_VARIANTS_LIST`
- `/base-data/uom-list` — `UomListComponent` — `BASE_DATA_UOM_LIST`

## Purpose
Manages the full product/item master data hierarchy:
`ItemCategory` → `ItemSubCategory` → `Product` (with `UOM`, `Variant`, `ProductType` as lookup references).

---

## CategoryFormComponent

### Selector
`app-category-form`

### Outputs
- `CatAdded: EventEmitter<ItemCategory>` — emits new category (for inline creation in sub-category form).

### API Calls
| Method | Endpoint |
|--------|----------|
| POST | `ItemCategories` |
| PUT | `ItemCategories(${id})` |

### ItemCategory Model
```typescript
interface ItemCategory {
  id?: number;
  name: string;
  prefix?: string;
  is_active: boolean;
}
```

### AG Grid dataSource (`item-category-list`)
```typescript
searchFields: ['name', 'custom_id', 'prefix']
```
Toolbar search covers name, custom_id, and prefix columns.

---

## SubCategoryFormComponent

### Selector
`app-sub-category-form`

### Inputs

| Input | Type | Purpose |
|-------|------|---------|
| `saveMode` | `string` | `'POST'` or `'PUT'` |

### Key Properties

| Property | Purpose |
|----------|---------|
| `ItemCategories` | `ItemCategory[]` — loaded from API for the dropdown |
| `selectedCategory` | `ItemCategory` — selected parent category |
| `categoryTitle` | Display name of selected category |

### Key Methods

| Method | Description |
|--------|-------------|
| `getItemCategory()` | `GET ItemCategories?$filter=is_active eq true` |
| `onCategoryChange(event)` | Sets `selectedCategory` from dropdown event |
| `saveSubCategory()` | Validates and saves sub-category |
| `validateForm()` | Requires `name` and `category_id` |

### API Calls
| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `ItemCategories?$orderby=id desc&$filter=is_active eq true` | Category dropdown |
| POST | `ItemSubCategories` | Create |
| PUT | `ItemSubCategories(${id})` | Update |

### ItemSubCategory Model
```typescript
interface ItemSubCategory {
  id?: number;
  name: string;
  item_category_id: number;
  is_active: boolean;
}
```

### AG Grid dataSource (`sub-category-list`)
```typescript
expand: 'category($select=id,name)',
searchFields: ['name', 'custom_id', 'category.name']
```
Grid shows a `category.name` column (valueGetter); search covers name, custom_id, and parent category name.

---

## UomFormComponent

### Selector
`app-uom-form`

### Outputs
- `UomAdded: EventEmitter<Uom>` — emits new UOM (for inline creation in product form).

### API Calls
| Method | Endpoint |
|--------|----------|
| POST | `Uoms` |
| PUT | `Uoms(${id})` |

### Uom Model
```typescript
interface Uom {
  id?: number;
  name: string;         // e.g. "kg", "pcs", "litre"
  abbreviation?: string;
  is_active: boolean;
}
```

---

## VariantFormComponent

### Selector
`app-variant-form`

### Purpose
Manages product variants (e.g., size, color options).

### API Calls
| Method | Endpoint |
|--------|----------|
| POST | `Variants` |
| PUT | `Variants(${id})` |

### Variant Model
```typescript
interface Variant {
  id?: number;
  name: string;
  is_active: boolean;
}
```

---

## ProductListComponent

### Purpose
Main product/item list and inline-edit grid. Most complex in this group — Products link to all lookup entities.

### AG Grid dataSource
```typescript
expand: 'suppliers,productTypes,category,clients,plants,variants,uom',
searchFields: ['item_code', 'product_name', 'part_number', 'model_number', 'rack_no', 'category.name'],
```
Category column uses valueGetter → `category.name` included in search.

### Key Relationships
- Product → belongs to ItemCategory
- Product → belongs to ItemSubCategory
- Product → has UOM (unit of measure)
- Product → has Variants (many-to-many)
- Product → has ProductType

### Product Model (inferred)
```typescript
interface Product {
  id?: number;
  name: string;
  code?: string;
  item_category_id?: number;
  item_sub_category_id?: number;
  uom_id?: number;
  product_type_id?: number;
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

| Component | Required Fields |
|-----------|----------------|
| CategoryForm | `name` |
| SubCategoryForm | `name`, `item_category_id` |
| UomForm | `name` |
| VariantForm | `name` |
| ProductForm | `name`, `uom_id` (at minimum) |

## Hierarchy & Setup Order
When configuring a new MES instance, create in this order:
1. `Uom` — unit definitions
2. `ItemCategory` — top-level categories
3. `ItemSubCategory` — sub-categories (requires categories)
4. `Variant` — variant options
5. `Products` — final items (reference all of the above)

## Notes
- `CatAdded` on `CategoryFormComponent` and `UomAdded` on `UomFormComponent` allow inline creation — similar to `MachineGroupFormComponent` in machine management.
- Product count is displayed on the home dashboard via the `$batch` call.
- Products are used in `OperationPositions` — they represent what item is being manufactured at a given operation.
