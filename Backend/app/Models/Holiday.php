<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Holiday extends Model
{
    protected $fillable = [
        'year',
        'start_date',
        'end_date',
        'type_id',
        'title',
    ];

    public function type()
    {
        return $this->belongsTo(HolidayType::class, 'type_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
