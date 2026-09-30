<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class EmployeeSalary extends Model
{
    use HasFactory;

    protected $fillable = [
        'employee_id',
        'total_salary',
        'basic',
        'house_rent',
        'medical_allowance',
        'transport_allowance',
        'other_allowance',
    ];
}
