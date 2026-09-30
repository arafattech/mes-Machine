<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveType extends Model
{
    use HasFactory;

    protected $table = 'leave_types';

    protected $fillable = [
        'name',
        'is_active',
        'max_days',
        'is_paid',
        'document_required',
        'approval_type_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_paid' => 'boolean',
        'document_required' => 'boolean',
    ];

    public function approvalType(): BelongsTo
    {
        return $this->belongsTo(ApprovalType::class);
    }
}
