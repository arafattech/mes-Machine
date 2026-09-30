<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\HasCustomId;

class EmployeeType extends Model
{
     use HasCustomId;
     protected $guarded = [];

     protected $casts = [
         'is_active' => 'boolean',
         'is_officer_staff' => 'boolean',
     ];
}
