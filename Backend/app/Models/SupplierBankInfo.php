<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Lodata\Attributes\LodataRelationship;

class SupplierBankInfo extends Model
{
    protected $guarded = [];

    #[LodataRelationship]
    public function supplier()
    {
        return $this->belongsTo(Supplier::class, 'supplier_id', 'id');
    }

    #[LodataRelationship]
    public function user()
    {
        return $this->belongsTo(User::class,'approved_by', 'id');
    }
    #[LodataRelationship]
    public function createdBy()
    {
        return $this->belongsTo(User::class,'created_by', 'id');
    }
}
