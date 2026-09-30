<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\Roster;
use Flat3\Lodata\Attributes\LodataRelationship;

class EmployeeGroup extends Model
{
     use HasCustomId;

    #[LodataRelationship]
    public function employees()
    {
        return $this->hasMany(Employee::class, 'group_id');
    }

    #[LodataRelationship]
    public function rosters()
    {
        return $this->hasMany(Roster::class, 'group_id');
    }

    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }
}
