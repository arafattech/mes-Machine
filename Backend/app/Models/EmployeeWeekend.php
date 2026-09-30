<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Flat3\Lodata\Attributes\LodataRelationship;

class EmployeeWeekend extends Model
{
    protected $guarded = [];

    protected $casts = [
        'bonus_amount' => 'decimal:2',
    ];

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    #[LodataRelationship]
    public function type()
    {
        return $this->belongsTo(HolidayType::class, 'type_id');
    }
}
