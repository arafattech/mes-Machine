<?php

namespace App\Models\Store;

use App\Models\ProductionLotCount;
use App\Models\User;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;

class YarnTransferAdviceLine extends Model
{
    protected $guarded = [];

    protected $casts = [
        'received_at' => 'datetime',
    ];

    #[LodataRelationship]
    public function advice()
    {
        return $this->belongsTo(YarnTransferAdvice::class, 'advice_id');
    }

    #[LodataRelationship]
    public function productionLotCount()
    {
        return $this->belongsTo(ProductionLotCount::class, 'production_lot_count_id');
    }

    #[LodataRelationship]
    public function receivedBy()
    {
        return $this->belongsTo(User::class, 'received_by');
    }
}
