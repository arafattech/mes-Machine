<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Flat3\Lodata\Attributes\LodataIdentifier;
use Flat3\Lodata\Attributes\LodataTypeIdentifier;
use Flat3\Lodata\Attributes\LodataRelationship;

class Notification extends Model
{
    use SoftDeletes;

    protected static function booted(): void
    {
        static::addGlobalScope('recipient', function (Builder $query) {
            if ($id = auth()->id()) {
                $query->where('recipient_id', $id);
            }
        });
    }

    protected $fillable = [
        'recipient_id',
        'sender_id',
        'model_type',
        'model_id',
        'model_custom_id',
        'action_type',
        'title',
        'message',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];

    #[LodataIdentifier('Notifications'), LodataTypeIdentifier('recipient')]
    public function recipient()
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    #[LodataRelationship]
    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }
}
