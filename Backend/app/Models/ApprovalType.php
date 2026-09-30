<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ApprovalType extends Model
{
    protected $guarded = [];

    public function setCodeAttribute($value): self
    {
        $this->attributes['code'] = strtoupper($value);

        return $this;
    }

    public function employees()
    {
        return $this->belongsToMany(Employee::class, 'approval_type_has_employees')
            ->withPivot(['is_required', 'sequence_index'])
            ->withTimestamps();
    }
}
