<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use App\Models\Employee;
use Flat3\Lodata\Attributes\LodataIdentifier;
use Flat3\Lodata\Attributes\LodataTypeIdentifier;
use Flat3\Lodata\Attributes\LodataRelationship;

class Notice extends Model
{
    use HasCustomId;
    protected $guarded = [];
    #[LodataRelationship]
    public function departments()
    {
        return $this->belongsToMany(Department::class, 'notices_departments');
    }

    #[LodataRelationship]
    public function employees()
    {
        return $this->belongsToMany(Employee::class, 'notices_employees')
            ->withPivot(['is_acknowledged', 'is_read', 'published_at'])
            ->withTimestamps();
    }
}
