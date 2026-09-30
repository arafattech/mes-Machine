<?php

namespace App\Models\Store;

use App\Models\Hall;
use App\Models\User;
use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Validation\ValidationException;

class YarnTransferAdvice extends Model
{
    use HasCustomId, SoftDeletes;

    // "advice" is grammatically uncountable — Eloquent's default pluralization guess
    // (str(class_basename)->snake()->plural()) leaves it unchanged as "yarn_transfer_advice",
    // which doesn't match the actual table name below.
    protected $table = 'yarn_transfer_advices';

    protected $guarded = [];

    protected $casts = [
        'transfer_date' => 'date',
        'hod_approved_at' => 'datetime',
        'store_received_at' => 'datetime',
        'gm_approved_at' => 'datetime',
    ];

    private const STATUS_TRANSITIONS = [
        'draft' => ['hod_approved', 'rejected', 'cancelled'],
        'hod_approved' => ['store_received', 'rejected', 'cancelled'],
        'store_received' => ['gm_approved', 'rejected'],
        'gm_approved' => [],
        'rejected' => ['draft'],
        'cancelled' => [],
    ];

    protected static function booted(): void
    {
        static::updating(function (YarnTransferAdvice $advice) {
            if (! $advice->isDirty('status')) {
                return;
            }

            $from = (string) $advice->getOriginal('status');
            $to = (string) $advice->status;
            $allowed = self::STATUS_TRANSITIONS[$from] ?? [];

            if (! in_array($to, $allowed, true)) {
                throw ValidationException::withMessages([
                    'status' => "Invalid yarn advice status transition from {$from} to {$to}.",
                ]);
            }
        });
    }

    #[LodataRelationship]
    public function preparedBy()
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    #[LodataRelationship]
    public function hodApprovedBy()
    {
        return $this->belongsTo(User::class, 'hod_approved_by');
    }

    #[LodataRelationship]
    public function storeReceivedBy()
    {
        return $this->belongsTo(User::class, 'store_received_by');
    }

    #[LodataRelationship]
    public function gmApprovedBy()
    {
        return $this->belongsTo(User::class, 'gm_approved_by');
    }

    #[LodataRelationship]
    public function fromHall()
    {
        return $this->belongsTo(Hall::class, 'from_hall_id');
    }

    #[LodataRelationship]
    public function lines()
    {
        return $this->hasMany(YarnTransferAdviceLine::class, 'advice_id');
    }
}
