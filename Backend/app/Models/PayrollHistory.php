<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PayrollHistory extends Model
{

    protected $table = 'payroll_histories';

    protected $fillable = [
        'start_date',
        'end_date',
        'total_employees',
        'total_salary',
        'total_deductions',
        'total_tax',
        'total_bonuses',
        'payment_method',
        'is_active',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'total_salary' => 'decimal:2',
        'total_deductions' => 'decimal:2',
        'total_tax' => 'decimal:2',
        'total_bonuses' => 'decimal:2',
    ];
    #[LodataRelationship]
    public function payrolls()
    {
        return $this->hasMany(Payroll::class, 'payroll_history_id');
    }
}
