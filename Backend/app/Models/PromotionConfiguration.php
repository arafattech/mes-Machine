<?php

namespace App\Models;

use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;

class PromotionConfiguration extends Model
{
    use HasCustomId;

    public const SCOPE_DEPARTMENT = 'department';
    public const SCOPE_EMPLOYEE_GROUP = 'employee_group';
    public const SCOPE_EMPLOYEE = 'employee';

    public const SCHEDULE_SERVICE_MONTHS = 'service_months';
    public const SCHEDULE_FIXED_DATE = 'fixed_date';
    public const SCHEDULE_DATE_RANGE = 'date_range';

    protected $guarded = [];

    protected $casts = [
        'is_active' => 'boolean',
        'months_of_service' => 'integer',
        'expiry_days' => 'integer',
        'eligibility_date' => 'date',
        'start_date' => 'date',
        'end_date' => 'date',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    #[LodataRelationship]
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    #[LodataRelationship]
    public function employeeGroup()
    {
        return $this->belongsTo(EmployeeGroup::class, 'employee_group_id');
    }

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }
}
