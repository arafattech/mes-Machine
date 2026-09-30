<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Lodata\Attributes\LodataRelationship;

class ItemCategory extends Model
{
     use HasCustomId;
     protected $guarded = [];

     #[LodataRelationship]
     public function subcategories()
     {
          return $this->hasMany(ItemSubCategory::class, 'category_id');
     }
}
