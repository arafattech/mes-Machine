<?php

namespace App\Models;

use Flat3\Lodata\Attributes\LodataIdentifier;
use Flat3\Lodata\Attributes\LodataTypeIdentifier;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use App\Traits\HasCustomId;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Validation\ValidationException;

class Product extends Model implements HasMedia
{
    use HasCustomId;

    use InteractsWithMedia {
        media as protected trait_media;
    }

    protected $guarded = [];

    protected static function booted(): void
    {
        // Leading = + - @ makes spreadsheet apps evaluate the value as a formula (CSV/Excel injection).
        static::saving(function (Product $product) {
            if (self::isFormulaLike($product->model_number)) {
                throw ValidationException::withMessages([
                    'model_number' => 'Model number must not start with =, +, - or @.',
                ]);
            }

            foreach (self::FORMULA_GUARDED_FIELDS as $field => $label) {
                if (self::isFormulaText($product->{$field})) {
                    throw ValidationException::withMessages([
                        $field => "{$label} must not be a spreadsheet formula.",
                    ]);
                }
            }
        });
    }

    /** Free-text/numeric columns that an Excel import can fill with raw formula text. */
    public const FORMULA_GUARDED_FIELDS = [
        'rack_no' => 'Rack number',
        'current_stock' => 'Current stock',
        'unit_price' => 'Unit price',
    ];

    /** Like isFormulaLike, but a plain signed number such as "-5" is not a formula. */
    public static function isFormulaText(mixed $value): bool
    {
        return self::isFormulaLike($value) && ! is_numeric(trim($value));
    }

    public static function isFormulaLike(mixed $value): bool
    {
        return is_string($value) && preg_match('/^\s*[=+\-@]/', $value) === 1;
    }

    #[
        LodataIdentifier('Products'),
        LodataTypeIdentifier('suppliers'),
    ]
    #[
        LodataIdentifier('Products'),
        LodataTypeIdentifier('productTypes'),
    ]
    #[
        LodataIdentifier('Products'),
        LodataTypeIdentifier('itemCategories'),
    ]

    #[
        LodataIdentifier('Products'),
        LodataTypeIdentifier('variants'),
    ]

    public function suppliers()
    {
        return $this->belongsToMany(Supplier::class, 'products_has_suppliers');
    }

    public function productTypes()
    {
        return $this->belongsToMany(ProductType::class, 'product_has_types');
    }

    public function itemCategories()
    {
        return $this->belongsToMany(ItemCategory::class, table: 'item_has_categories');
    }
    #[LodataRelationship]
    public function category()
    {
        return $this->belongsTo(ItemCategory::class, 'item_category_id', 'id');
    }

    public function itemSubCategories()
    {
        return $this->belongsToMany(ItemSubCategory::class, 'product_has_subcategory', 'product_id', 'subcategory_id')
            ->withPivot('category_id')
            ->withTimestamps();
    }
    public function clients()
    {
        return $this->belongsToMany(Client::class, 'client_product');
    }

    public function plants()
    {
        return $this->belongsToMany(Plant::class, 'product_has_plants');
    }

    #[LodataRelationship]
    public function variants()
    {
        return $this->hasMany(Product::class,'parent_id','id');
    }
    

    #[LodataRelationship]
    public function media(): MorphMany
    {
        return $this->trait_media();
    }

    public function uom()
    {
        return $this->belongsTo(Uom::class, 'uom_id', 'id');
    }
}
