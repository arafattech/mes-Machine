<?php

namespace App\Models;

use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;

class EmployeeBonus extends Model
{
    protected $table = 'employee_bonuses';

    protected $fillable = [
        'bonus_type',
        'amount',
        'description',
        'group_id',
        'emp_id',
        'config_id',
        'department_id',
        'attendance_log_id',
        'shift_id',
        'attendance_date',
        'overtime_minutes',
        'calculation_type',
        'bonus_config_amount',
        'bonus_type_id',
        'source_type',
        'remarks',
        'status',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'attendance_date' => 'date',
        'overtime_minutes' => 'integer',
        'bonus_config_amount' => 'decimal:2',
    ];

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'emp_id');
    }

    #[LodataRelationship]
    public function attendanceLog()
    {
        return $this->belongsTo(AttendanceLog::class);
    }

    #[LodataRelationship]
    public function bonusConfig()
    {
        return $this->belongsTo(BonusConfig::class, 'config_id');
    }

    #[LodataRelationship]
    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }

    #[LodataRelationship]
    public function bonusType()
    {
        return $this->belongsTo(BonusType::class, 'bonus_type_id');
    }
}
