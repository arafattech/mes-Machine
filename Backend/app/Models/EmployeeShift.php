<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use App\Models\Employee;

class EmployeeShift extends Model
{
    use HasCustomId;

    protected $casts = [
        'is_ramadan_bonus' => 'boolean',
    ];

    public function employees()
    {
        return $this->hasMany(Employee::class, 'shift_id');
    }

     public function rosters()
    {
        return $this->hasMany(Roster::class, 'shift_id');
    }

    public function shiftOverrides()
    {
        return $this->hasMany(ShiftOverrides::class, 'shift_id');
    }
}
