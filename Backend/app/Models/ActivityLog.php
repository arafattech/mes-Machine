<?php

namespace App\Models;

use Illuminate\Database\Eloquent\SoftDeletes;
use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataIdentifier;
use Flat3\Lodata\Attributes\LodataTypeIdentifier;
use Illuminate\Database\Eloquent\Model;
use App\Models\User;

class ActivityLog extends Model
{
    use  SoftDeletes;
    protected $fillable = [
        'user_id',
        'user_name',
        'user_email',
        'custom_id',
        'model_type',
        'model_id',
        'model_custom_id',
        'action_type',
        'old_value',
        'new_value',
        'ip_address',
        'session_id',
    ];

    #[
        LodataIdentifier('ActivityLogs'),
        LodataTypeIdentifier('user'),

    ]
    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
