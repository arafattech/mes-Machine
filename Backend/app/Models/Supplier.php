<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Lodata\Attributes\LodataRelationship;

class Supplier extends Model
{
    use HasCustomId;

    public function suppliers()
    {
        return $this->belongsToMany(Product::class, 'products_has_suppliers');
    }

    #[LodataRelationship]
    public function bankInfo()
    {
        return $this->hasOne(SupplierBankInfo::class, 'supplier_id', 'id');
    }

    #[LodataRelationship]
    public function origin()
    {
        return $this->belongsTo(Origin::class);
    }

    public function bankInfos()
    {
        return $this->hasMany(SupplierBankInfo::class);
    }

    #[LodataRelationship]
    public function supplierBanks()
    {
        return $this->hasMany(SupplierBankInfo::class)
                    ->where('mode_of_payment', 'bank_transfer');
    }

    #[LodataRelationship]
    public function supplierCash()
    {
        return $this->hasMany(SupplierBankInfo::class)
                    ->where('mode_of_payment', 'cash');
    }

}
