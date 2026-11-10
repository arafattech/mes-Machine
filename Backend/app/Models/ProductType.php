<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use App\Traits\RequiresAttributes;
use App\Traits\HasCustomId;
class ProductType extends Model
{
    use RequiresAttributes;

    protected array $requiredAttributes = ['name'];

    use HasCustomId;
}
