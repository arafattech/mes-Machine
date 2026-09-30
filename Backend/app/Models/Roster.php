<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Flat3\Lodata\Attributes\LodataRelationship;
use App\Traits\HasCustomId;
use App\Models\Employee;
use App\Models\EmployeeShift;
use App\Models\EmployeeGroup;
use App\Models\ShiftOverrides;

class Roster extends Model
{
    use HasCustomId;

    protected $guarded = [];

    public function employee()
    {
        return $this->belongsTo(Employee::class, 'employee_id');
    }

    #[LodataRelationship]
    public function shift()
    {
        return $this->belongsTo(EmployeeShift::class, 'shift_id', 'id');
    }

    #[LodataRelationship]
    public function group()
    {
        return $this->belongsTo(EmployeeGroup::class, 'group_id', 'id');
    }

    #[LodataRelationship]
    public function groups()
    {
        return $this->belongsToMany(EmployeeGroup::class, 'roster_has_groups', 'roster_id', 'group_id');
    }

    public function shiftOverrides()
    {
        return $this->hasMany(ShiftOverrides::class, 'roster_id');
    }

    // Pivot 'groups' is the source of truth once a roster is saved via the multi-group
    // flow; legacy 'group_id' is a compat shim for older rows and other consumers
    // (DailyAttendanceService, EmployeeController) that still match on a single group.
    public function getGroupsListAttribute(): array
    {
        $pivotGroups = $this->relationLoaded('groups') ? $this->groups : $this->groups()->get();

        if ($pivotGroups->isNotEmpty()) {
            return $pivotGroups->map(fn($group) => ['id' => $group->id, 'name' => $group->name])->all();
        }

        if ($this->group_id) {
            $legacyGroup = $this->relationLoaded('group') ? $this->group : $this->group()->first();
            return $legacyGroup ? [['id' => $legacyGroup->id, 'name' => $legacyGroup->name]] : [];
        }

        return [];
    }

    public function getAllGroupIdsAttribute(): array
    {
        return array_column($this->groups_list, 'id');
    }
}
