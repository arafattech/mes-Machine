<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use App\Models\EmployeeGroup;
use App\Models\Department;
use App\Models\Employee;
use Flat3\Lodata\Attributes\LodataRelationship;

class BonusConfig extends Model
{
    use HasCustomId;

    protected $guarded = [];

    #[LodataRelationship]
    public function group()
    {
        return $this->belongsTo(EmployeeGroup::class, 'group_id');
    }

    #[LodataRelationship]
    public function department()
    {
        return $this->belongsTo(Department::class, 'department_id');
    }

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    #[LodataRelationship]
    public function bonusType()
    {
        return $this->belongsTo(BonusType::class, 'bonus_type_id');
    }

    #[LodataRelationship]
    public function employeeBonuses()
    {
        return $this->hasMany(EmployeeBonus::class, 'config_id');
    }
}
