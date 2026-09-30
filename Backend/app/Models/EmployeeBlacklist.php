<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;
use Flat3\Lodata\Attributes\LodataRelationship;
use App\Models\Employee;
use App\Models\User;


class EmployeeBlacklist extends Model
{
    use HasCustomId;

    #[LodataRelationship]
    public function employee()
    {
        return $this->belongsTo(Employee::class);
    }
     #[LodataRelationship]
    public function user()
    {
        return $this->belongsTo(User::class, 'added_by', 'id');
    }
}
