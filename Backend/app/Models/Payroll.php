<?php

namespace App\Models;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;

class Payroll extends Model
{

    protected $table = 'payrolls';

    protected $fillable = [
        'employee_id',
        'month',
        'year',
        'basic_salary',
        'allowances',
        'overtime',
        'overtime_bonus',
        'bonuses',
        'side_bill',
        'gross_salary',
        'tax',
        'social_security',
        'loans',
        'penalties',
        'other_deductions',
        'total_deductions',
        'net_salary',
        'currency',
        'status',
        'processed_at',
        'paid_at',
        'payment_method',
        'transaction_ref',
        'hr_notes',
        'total_attendance',
        'total_nightshift',
        'nightshift_bonus',
        'attendance_bonus',
        'ramadan_bonus',
        'holiday_bonus',
        'total_holidays',
        'start_date',
        'end_date',
        'total_payable_days',
        'payroll_history_id',
    ];

    protected $dates = [
        'processed_at',
        'paid_at',
        'created_at',
        'updated_at',
    ];
    protected $casts = [
        'processed_at' => 'datetime',
        'created_at' => 'datetime',
        'start_date' => 'datetime',
        'end_date' => 'datetime',
    ];

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
    #[LodataRelationship]
    public function PayrollHistories()
    {
        return $this->belongsTo(PayrollHistory::class, 'payroll_history_id');
    }
}
