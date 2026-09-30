<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Flat3\Lodata\Attributes\LodataRelationship;
use App\Traits\HasCustomId;
use Illuminate\Http\Request;

class ShiftOverrides extends Model
{
    use HasCustomId;
    protected $guarded = [];

    protected $casts = [
        'date' => 'date',
    ];

    public function replacementEmployee()
    {
        return $this->belongsTo(Employee::class, 'replacement_employee_id');
    }

    public function absentEmployee()
    {
        return $this->belongsTo(Employee::class, 'absent_employee_id');
    }

    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }

        public function target_shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'second_shift_id');
    }
    
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'shift_id');
    }

    public function secondShift()
    {
        return $this->belongsTo(EmployeeShift::class, 'second_shift_id');
    }

    public function roster()
    {
        return $this->belongsTo(Roster::class, 'roster_id');
    }

}
