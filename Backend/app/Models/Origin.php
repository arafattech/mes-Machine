<?php

namespace App\Models;

use App\Traits\HasCustomId;
use Illuminate\Database\Eloquent\Model;

class Origin extends Model
{
    use HasCustomId;

    protected $guarded = [];
}
