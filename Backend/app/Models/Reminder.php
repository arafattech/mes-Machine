<?php

namespace App\Models;

use App\Models\Store\MaterialReceipt;
use Illuminate\Database\Eloquent\Model;
use Flat3\Lodata\Attributes\LodataRelationship;

class Reminder extends Model
{
    protected $fillable = [
        'mrr_id',
        'message',
        'purchase_message',
        'reminder_date',
        'is_read',
        'created_by',
    ];

    protected $casts = [
        'reminder_date' => 'date',
        'is_read' => 'boolean',
    ];

    #[LodataRelationship]
    public function mrr()
    {
        return $this->belongsTo(MaterialReceipt::class, 'mrr_id', 'id');
    }

    #[LodataRelationship]
    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
