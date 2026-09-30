<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LeaveDate extends Model
{

   protected $fillable = [
        'employee_id',
        'leave_id',
        'leave_date',
        'status',
        'type',
    ];

    public function leaveRequest()
    {
        return $this->belongsTo(LeaveRequest::class, 'leave_id');
    }

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
