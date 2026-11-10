<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\RequiresAttributes;
use App\Traits\HasCustomId;

class CountType extends Model
{
    use RequiresAttributes;

    protected array $requiredAttributes = ['name'];

    use HasCustomId;

    protected $guarded = [];
}
