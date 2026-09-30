<?php

namespace App\Models;
use App\Traits\HasCustomId;

use Illuminate\Database\Eloquent\Model;

class SalaryType extends Model
{
    use HasCustomId;
    protected $guarded = [];
}
