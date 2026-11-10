<?php

namespace App\Models;
use App\Traits\HasCustomId;

use Illuminate\Database\Eloquent\Model;
use App\Traits\RequiresAttributes;

class Variant extends Model
{
    use RequiresAttributes;

    protected array $requiredAttributes = ['name'];

    use HasCustomId;
}
