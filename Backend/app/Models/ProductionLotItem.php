<?php

namespace App\Models;

use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;

class ProductionLotItem extends Model
{
    protected $guarded = [];

    protected $casts = [
        'gross_weight_kg' => 'decimal:2',
        'net_weight_kg' => 'decimal:2',
    ];

    #[LodataRelationship]
    public function productionLotCount()
    {
        return $this->belongsTo(ProductionLotCount::class, 'production_lot_count_id');
    }
}
