<?php

namespace App\Models\Store;

use App\Models\User;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class MrrReturn extends Model
{
    use HasFactory, SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'return_date' => 'date',
    ];

    #[LodataRelationship]
    public function materialReceipt()
    {
        return $this->belongsTo(MaterialReceipt::class, 'material_receipt_id', 'id');
    }

    #[LodataRelationship]
    public function returnedBy()
    {
        return $this->belongsTo(User::class, 'returned_by', 'id');
    }

    #[LodataRelationship]
    public function items()
    {
        return $this->hasMany(MrrReturnItem::class, 'mrr_return_id', 'id');
    }
}
