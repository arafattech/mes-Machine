<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Flat3\Lodata\Attributes\LodataRelationship;

class EmployeeHolidaySwap extends Model
{

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    #[LodataRelationship]
    public function weekend()
    {
        return $this->belongsTo(EmployeeWeekend::class, 'weekend_id');
    }
}
