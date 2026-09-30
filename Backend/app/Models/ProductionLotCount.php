<?php

namespace App\Models;

use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\ValidationException;

class ProductionLotCount extends Model
{
    use HasCustomId, SoftDeletes;

    protected $guarded = [];

    protected $casts = [
        'qc_checked_at' => 'datetime',
        'packed_at' => 'datetime',
        'reconciled_at' => 'datetime',
    ];

    // PENDING_TRANSFER -> PACKED is the GTN "recall" path (goods never left custody yet),
    // distinct from PENDING_TRANSFER -> REJECTED which is the store refusing a delivered GTN.
    private const STATUS_TRANSITIONS = [
        'DOFFED' => ['QC_FAILED', 'PACKED', 'CANCELLED'],
        'QC_FAILED' => ['CANCELLED'],
        'PACKED' => ['PENDING_TRANSFER', 'CANCELLED'],
        'PENDING_TRANSFER' => ['RECEIVED', 'REJECTED', 'CANCELLED', 'PACKED'],
        'REJECTED' => ['PENDING_TRANSFER', 'CANCELLED'],
        'RECEIVED' => ['RECONCILED'],
        'RECONCILED' => [],
        'CANCELLED' => [],
    ];

    protected static function booted(): void
    {
        static::updating(function (ProductionLotCount $count) {
            if (! $count->isDirty('status')) {
                return;
            }

            $from = (string) $count->getOriginal('status');
            $to = (string) $count->status;
            $allowed = self::STATUS_TRANSITIONS[$from] ?? [];

            if (! in_array($to, $allowed, true)) {
                throw ValidationException::withMessages([
                    'status' => "Invalid lot count status transition from {$from} to {$to}.",
                ]);
            }
        });
    }

    #[LodataRelationship]
    public function productionLot()
    {
        return $this->belongsTo(ProductionLot::class, 'production_lot_id');
    }

    #[LodataRelationship]
    public function countType()
    {
        return $this->belongsTo(CountType::class, 'count_type_id');
    }

    #[LodataRelationship]
    public function product()
    {
        return $this->belongsTo(Product::class, 'product_id');
    }

    #[LodataRelationship]
    public function qcCheckedBy()
    {
        return $this->belongsTo(User::class, 'qc_checked_by');
    }

    #[LodataRelationship]
    public function packedBy()
    {
        return $this->belongsTo(User::class, 'packed_by');
    }

    #[LodataRelationship]
    public function reconciledBy()
    {
        return $this->belongsTo(User::class, 'reconciled_by');
    }

    #[LodataRelationship]
    public function items()
    {
        return $this->hasMany(ProductionLotItem::class, 'production_lot_count_id');
    }
}
