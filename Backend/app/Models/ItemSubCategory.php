<?php

namespace App\Models;

use App\Traits\HasCustomId;
use Illuminate\Database\Eloquent\Model;

class ItemSubCategory extends Model
{
    use HasCustomId;

   protected $table = 'item_subcategories';
     #[LodataRelationship]
   public function category()
    {
        return $this->belongsTo(ItemCategory::class, 'category_id','id');
    }
}
