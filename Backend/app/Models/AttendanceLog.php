<?php

namespace App\Models;

use App\Traits\HasCustomId;
use App\Models\Employee;
use App\Models\EmployeeBonus;
use App\Models\EmployeeShift;
use App\Services\hrModule\EmployeeRosterService;
use App\Services\hrModule\OvertimeBonusService;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;

class AttendanceLog extends Model
{
    use HasCustomId;

    protected $fillable = [
        'employee_id',
        'employee_no',
        'attendance_date',
        'check_in_time',
        'check_out_time',
        'over_time',
        'has_overtime',
        'shift_id',
        'is_active',
        'attendance_status',
        'absent_type',
        'overtime_minutes',
        'overtime_status',
        'is_ramadan_duty',
        'is_holiday_bonus_duty',
        'ramadan_status',
        'holiday_bonus_status',
        'is_ot',
        'extra_shift_status',
    ];

    protected $casts = [
        'is_ramadan_duty' => 'boolean',
        'is_holiday_bonus_duty' => 'boolean',
        'is_ot' => 'boolean',
    ];

    protected static function booted(): void
    {
        static::creating(function (AttendanceLog $attendance) {
            if (!$attendance->employee_no && $attendance->employee_id) {
                $attendance->employee_no = Employee::find($attendance->employee_id)?->employee_no;
            }

            if (!$attendance->status) {
                $attendance->status = 'VALID';
            }

            app(EmployeeRosterService::class)->resolveIsOt($attendance);
        });

        static::created(function (AttendanceLog $attendance) {
            app(OvertimeBonusService::class)->syncForAttendance($attendance);
        });
    }

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }

    #[LodataRelationship]
    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id');
    }

    #[LodataRelationship]
    public function employeeBonuses()
    {
        return $this->hasMany(EmployeeBonus::class, 'attendance_log_id');
    }
}
