<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\RequiresAttributes;
use App\Traits\HasCustomId;
use Lodata\Attributes\LodataRelationship;
use Illuminate\Validation\ValidationException;

class ItemCategory extends Model
{
    use RequiresAttributes;

    protected array $requiredAttributes = ['name'];

     use HasCustomId;
     protected $guarded = [];

     protected static function booted(): void
     {
          static::saving(function (ItemCategory $category) {
               if (trim((string) $category->name) === '') {
                    throw ValidationException::withMessages([
                         'name' => 'Category name is required.',
                    ]);
               }
          });
     }

     #[LodataRelationship]
     public function subcategories()
     {
          return $this->hasMany(ItemSubCategory::class, 'category_id');
     }
}
