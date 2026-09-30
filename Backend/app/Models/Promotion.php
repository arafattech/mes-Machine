<?php

namespace App\Models;

use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;
use Illuminate\Database\Eloquent\Model;

class Promotion extends Model
{
    use HasCustomId;

    public const STATUS_PENDING = 'pending';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_DECLINED = 'declined';
    public const STATUS_EXPIRED = 'expired';

    protected $guarded = [];

    protected $casts = [
        'is_active' => 'boolean',
        'old_salary' => 'decimal:2',
        'new_salary' => 'decimal:2',
        'salary_increment' => 'decimal:2',
        'inc_value' => 'decimal:2',
        'promotion_date' => 'date',
        'effective_date' => 'date',
        'cycle_base_date' => 'date',
        'eligibility_date' => 'date',
        'expires_at' => 'date',
        'approved_at' => 'datetime',
    ];

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    #[LodataRelationship]
    public function oldDepartment()
    {
        return $this->belongsTo(Department::class, 'old_department_id');
    }

    #[LodataRelationship]
    public function newDepartment()
    {
        return $this->belongsTo(Department::class, 'new_department_id');
    }

    #[LodataRelationship]
    public function approvedBy()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    #[LodataRelationship]
    public function configuration()
    {
        return $this->belongsTo(PromotionConfiguration::class, 'promotion_configuration_id');
    }
}
