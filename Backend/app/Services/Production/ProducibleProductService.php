<?php

namespace App\Services\Production;

use App\Models\Product;
use App\Models\ProductType;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Log;

/**
 * Products that can be produced: members of the configured ProductTypes
 * (`mes.producible_product_type_names`). Plain Eloquent because lodata's any() over the
 * belongsToMany product types generates broken SQL.
 */
class ProducibleProductService
{
    private const DEFAULT_LIMIT = 50;

    private static bool $warnedUnfiltered = false;

    /** Active producible products whose name contains `$search`, alphabetically. */
    public function search(?string $search, ?int $limit): Collection
    {
        $typeNames = config('mes.producible_product_type_names');

        return Product::query()
            ->where('is_active', true)
            ->when($this->hasProducibleTypes($typeNames), fn ($q) => $q->whereHas(
                'productTypes',
                fn ($t) => $t->whereIn('product_types.name', $typeNames)->where('product_types.is_active', true),
            ))
            ->when($search, fn ($q) => $q->where('product_name', 'like', '%' . addcslashes($search, '%_\\') . '%'))
            ->orderBy('product_name')
            ->limit($limit ?? self::DEFAULT_LIMIT)
            ->get(['id', 'product_name']);
    }

    /** Names for products already chosen on a form, whatever their type. */
    public function find(array $ids): Collection
    {
        return Product::whereIn('id', $ids)->get(['id', 'product_name']);
    }

    /**
     * Only active types count. Until products are tagged with a producible type the list stays unfiltered rather than
     * empty (which would block order entry); warned once per worker.
     */
    private function hasProducibleTypes(array $typeNames): bool
    {
        $exists = ProductType::whereIn('name', $typeNames)->where('is_active', true)->exists();
        if (! $exists && ! self::$warnedUnfiltered) {
            self::$warnedUnfiltered = true;
            Log::warning('No producible ProductType found; product list is unfiltered.', ['types' => $typeNames]);
        }

        return $exists;
    }
}
